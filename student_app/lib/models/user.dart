class User {
  final String id;
  final String name;
  final String email;
  final String role;
  final String collegeId;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.role,
    required this.collegeId,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String,
      name: json['name'] as String,
      email: json['email'] as String,
      role: json['role'] as String,
      collegeId: json['collegeId'] as String,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role': role,
      'collegeId': collegeId,
    };
  }
}
