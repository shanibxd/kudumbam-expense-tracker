# 🏠 Kudumbam Expense Tracker

> A secure family expense management application with individual user accounts, private expense data, smart expense entry, family management, budgeting, insights, and more.

Kudumbam Expense Tracker is a full-stack expense management application designed to help individuals and families manage their daily expenses in a simple and organized way.

The application includes **secure registration and login**, with every user's data completely isolated from other users.

---

## ✨ Specialities

### 🔐 Secure User Authentication

Every person gets their own account.

- User registration
- User login/logout
- Secure password hashing with bcrypt
- Passwords are never stored as plain text
- Session-based authentication
- Protected application routes
- Generic login errors to prevent account enumeration
- Unique email validation
- Password confirmation during registration

---

### 👤 Per-User Data Isolation

This is one of the main security features of Kudumbam.

Each user's:

- Expenses
- Budget
- Categories
- Family members
- PIN settings
- Application settings

are stored separately.

For example:

```text
User A
 ├── Expenses
 ├── Budget
 ├── Categories
 └── Family Members

User B
 ├── Expenses
 ├── Budget
 ├── Categories
 └── Family Members
