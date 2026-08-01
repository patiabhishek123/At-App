package db

import (
	"os"
	"testing"
)

func TestRowLevelSecurity(t *testing.T) {
	// 1. Establish connection to local Postgres container
	// (Assumes docker-compose is running and database is up)
	cfg := Config{
		Host:     "localhost",
		Port:     5433,
		User:     "atapp_user",
		Password: "atapp_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}

	dbConn, err := Connect(cfg)
	if err != nil {
		t.Fatalf("Failed to connect to database: %v. Make sure docker-compose is running.", err)
	}

	// 2. Read and apply the database schema (migration 001_init.sql)
	schemaSQL, err := os.ReadFile("migrations/001_init.sql")
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to read migration script: %v", err)
	}

	_, err = dbConn.Exec(string(schemaSQL))
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to execute migration script: %v", err)
	}

	// Onboard College A and College B using the superuser admin connection
	var collegeAId, collegeBId string
	err = dbConn.QueryRow("INSERT INTO colleges (name) VALUES ('MIT') RETURNING id").Scan(&collegeAId)
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to insert College A as admin: %v", err)
	}
	err = dbConn.QueryRow("INSERT INTO colleges (name) VALUES ('Harvard') RETURNING id").Scan(&collegeBId)
	if err != nil {
		dbConn.Close()
		t.Fatalf("Failed to insert College B as admin: %v", err)
	}
	dbConn.Close()

	// 3. Connect as the non-superuser application user to test RLS
	appCfg := Config{
		Host:     "localhost",
		Port:     5433,
		User:     "app_user",
		Password: "app_password",
		DBName:   "atapp_db",
		SSLMode:  "disable",
	}
	dbConn, err = Connect(appCfg)
	if err != nil {
		t.Fatalf("Failed to connect to database as app_user: %v", err)
	}
	defer dbConn.Close()

	// 4. Populate test data under a restricted role (RLS is active. We must set context per tenant insertion).
	var deptAId, deptBId string
	var userAId, userBId string // Students

	// Initialize Tenant A data
	tx, err := dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin init transaction: %v", err)
	}

	// We must set context to College A to insert dependent rows under RLS
	if err := WithTenant(tx, collegeAId); err != nil {
		tx.Rollback()
		t.Fatalf("Failed to set Tenant A: %v", err)
	}

	err = tx.QueryRow("INSERT INTO departments (college_id, name) VALUES ($1, 'Computer Science') RETURNING id", collegeAId).Scan(&deptAId)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to insert Dept A: %v", err)
	}

	err = tx.QueryRow("INSERT INTO users (college_id, role, name, email, password_hash) VALUES ($1, 'student', 'Alice', 'alice@mit.edu', 'hashA') RETURNING id", collegeAId).Scan(&userAId)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to insert User A: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit Tenant A init: %v", err)
	}

	// Initialize Tenant B data
	tx, err = dbConn.Begin()
	if err != nil {
		t.Fatalf("Failed to begin init transaction: %v", err)
	}

	// Set context to College B to insert dependent rows under RLS
	if err := WithTenant(tx, collegeBId); err != nil {
		tx.Rollback()
		t.Fatalf("Failed to set Tenant B: %v", err)
	}

	err = tx.QueryRow("INSERT INTO departments (college_id, name) VALUES ($1, 'Physics') RETURNING id", collegeBId).Scan(&deptBId)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to insert Dept B: %v", err)
	}

	err = tx.QueryRow("INSERT INTO users (college_id, role, name, email, password_hash) VALUES ($1, 'student', 'Bob', 'bob@harvard.edu', 'hashB') RETURNING id", collegeBId).Scan(&userBId)
	if err != nil {
		tx.Rollback()
		t.Fatalf("Failed to insert User B: %v", err)
	}

	if err := tx.Commit(); err != nil {
		t.Fatalf("Failed to commit Tenant B init: %v", err)
	}

	// =========================================================================
	// TEST 1: Query as Tenant A (Should only see Tenant A data)
	// =========================================================================
	t.Run("Query as Tenant A", func(t *testing.T) {
		tx, err := dbConn.Begin()
		if err != nil {
			t.Fatalf("Failed to begin tx: %v", err)
		}
		defer tx.Rollback()

		if err := WithTenant(tx, collegeAId); err != nil {
			t.Fatalf("Failed to set context: %v", err)
		}

		// Count colleges (should be 1: MIT)
		var count int
		err = tx.QueryRow("SELECT COUNT(*) FROM colleges").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 college, got %d", count)
		}

		var collegeName string
		err = tx.QueryRow("SELECT name FROM colleges").Scan(&collegeName)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if collegeName != "MIT" {
			t.Errorf("Expected college MIT, got %s", collegeName)
		}

		// Count departments (should be 1: Computer Science)
		err = tx.QueryRow("SELECT COUNT(*) FROM departments").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 department, got %d", count)
		}

		// Count users (should be 1: Alice)
		err = tx.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 user, got %d", count)
		}

		var userName string
		err = tx.QueryRow("SELECT name FROM users").Scan(&userName)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if userName != "Alice" {
			t.Errorf("Expected user Alice, got %s", userName)
		}

		// Try to insert a department for Tenant B while bound to Tenant A (should fail WITH CHECK)
		_, err = tx.Exec("INSERT INTO departments (college_id, name) VALUES ($1, 'Biology')", collegeBId)
		if err == nil {
			t.Error("Expected insert to fail RLS check, but it succeeded")
		}
	})

	// =========================================================================
	// TEST 2: Query as Tenant B (Should only see Tenant B data)
	// =========================================================================
	t.Run("Query as Tenant B", func(t *testing.T) {
		tx, err := dbConn.Begin()
		if err != nil {
			t.Fatalf("Failed to begin tx: %v", err)
		}
		defer tx.Rollback()

		if err := WithTenant(tx, collegeBId); err != nil {
			t.Fatalf("Failed to set context: %v", err)
		}

		// Count colleges (should be 1: Harvard)
		var count int
		err = tx.QueryRow("SELECT COUNT(*) FROM colleges").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 college, got %d", count)
		}

		var collegeName string
		err = tx.QueryRow("SELECT name FROM colleges").Scan(&collegeName)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if collegeName != "Harvard" {
			t.Errorf("Expected college Harvard, got %s", collegeName)
		}

		// Count departments (should be 1: Physics)
		err = tx.QueryRow("SELECT COUNT(*) FROM departments").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 department, got %d", count)
		}

		// Count users (should be 1: Bob)
		err = tx.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 1 {
			t.Errorf("Expected 1 user, got %d", count)
		}

		var userName string
		err = tx.QueryRow("SELECT name FROM users").Scan(&userName)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if userName != "Bob" {
			t.Errorf("Expected user Bob, got %s", userName)
		}
	})

	// =========================================================================
	// TEST 3: Query without Tenant context (Should see 0 rows under RLS)
	// =========================================================================
	t.Run("Query without Tenant context", func(t *testing.T) {
		tx, err := dbConn.Begin()
		if err != nil {
			t.Fatalf("Failed to begin tx: %v", err)
		}
		defer tx.Rollback()

		// Do not set context (or set to empty string)
		if err := ClearTenant(tx); err != nil {
			t.Fatalf("Failed to clear context: %v", err)
		}

		var count int
		err = tx.QueryRow("SELECT COUNT(*) FROM colleges").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 0 {
			t.Errorf("Expected 0 colleges visible, got %d", count)
		}

		err = tx.QueryRow("SELECT COUNT(*) FROM users").Scan(&count)
		if err != nil {
			t.Fatalf("Query failed: %v", err)
		}
		if count != 0 {
			t.Errorf("Expected 0 users visible, got %d", count)
		}
	})
}
