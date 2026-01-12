# 👥 Admin Access System - Dual Admin Setup

## 📋 Overview

This system supports **TWO admin accounts** with different permission levels:

1. **Full Admin** (shubhamag1412@gmail.com) - Complete access including DELETE
2. **Admin Create** (connectartistpushp@gmail.com) - All access EXCEPT DELETE

---

## 🔑 Admin Accounts

### 1. Full Admin Account
- **Email:** `shubhamag1412@gmail.com`
- **Role:** `admin`
- **Permissions:**
  - ✅ View all profiles
  - ✅ Create new artists
  - ✅ Edit artist profiles
  - ✅ Reset passwords
  - ✅ **DELETE artists** ⚠️
  - ✅ Access Admin Dashboard button in frontend

### 2. Admin Create Account
- **Email:** `connectartistpushp@gmail.com`
- **Role:** `admin-create`
- **Permissions:**
  - ✅ View all profiles
  - ✅ Create new artists
  - ✅ Edit artist profiles
  - ✅ Reset passwords
  - ❌ **CANNOT DELETE artists** 🚫
  - ✅ Access Admin Dashboard button in frontend

---

## 🎯 How It Works

### Login Flow

1. **User logs in** with Google OAuth
2. **System checks email** against admin list
3. **Assigns role** based on email:
   - `shubhamag1412@gmail.com` → role = `'admin'`
   - `connectartistpushp@gmail.com` → role = `'admin-create'`
   - Other emails → role = `'user'` (regular user)
4. **Frontend displays** Admin Dashboard button for both admin roles
5. **Admin Dashboard** shows/hides Delete button based on role

### Frontend Behavior (frontend.html)

**Admin Dashboard Button Visibility:**
```javascript
// Shows button for BOTH admin and admin-create roles
if (user.role === 'admin' || user.role === 'admin-create') {
  // Show "Admin Dashboard" button
}
```

### Admin Dashboard (admin.html)

**Delete Button Visibility:**
```javascript
// Only shows Delete button for full admin
if (currentUserRole === 'admin') {
  // Show "Delete" button
} else {
  // Hide "Delete" button (admin-create cannot see it)
}
```

### Backend Permissions (server.js)

**Permission Check Function:**
```javascript
function checkAdminPermission(user, requiredPermission) {
  // Full admin (shubhamag1412@gmail.com)
  if (user.role === 'admin') {
    return { hasPermission: true }; // All permissions
  }

  // Admin Create (connectartistpushp@gmail.com)
  if (user.role === 'admin-create') {
    const allowedPermissions = ['read', 'create', 'update', 'reset-password'];
    if (allowedPermissions.includes(requiredPermission)) {
      return { hasPermission: true };
    } else {
      return { hasPermission: false, message: 'Insufficient admin permissions. Cannot delete profiles.' };
    }
  }
}
```

**Delete Endpoint Protection:**
```javascript
app.delete('/api/profiles/:id', async (req, res) => {
  // Check if user has 'delete' permission
  const permissionCheck = checkAdminPermission(adminUser, 'delete');

  if (!permissionCheck.hasPermission) {
    // Returns 403 error for admin-create role
    return res.status(403).json({
      success: false,
      message: 'Insufficient admin permissions. Cannot delete profiles.'
    });
  }

  // Only reaches here if role === 'admin'
  await Profile.findByIdAndDelete(req.params.id);
});
```

---

## 🔒 Security Features

### Role Assignment (server.js)
```javascript
// Assigned during Google OAuth callback
if (emailLower === 'shubhamag1412@gmail.com') {
    user.role = 'admin'; // Full admin access (can delete)
    await user.save();
} else if (emailLower === 'connectartistpushp@gmail.com') {
    user.role = 'admin-create'; // Admin access without delete permission
    await user.save();
}
```

### Frontend Protection
- Delete button is **hidden** for `admin-create` role
- User cannot even see the delete option

### Backend Protection
- Delete endpoint **checks permissions**
- Returns **403 Forbidden** if `admin-create` tries to delete
- Double layer of security (UI + API)

---

## 📊 Permission Matrix

| Action | Full Admin (shubhamag1412) | Admin Create (connectartistpushp) |
|--------|---------------------------|-----------------------------------|
| Login to Frontend | ✅ Yes | ✅ Yes |
| See Admin Dashboard Button | ✅ Yes | ✅ Yes |
| Access Admin Dashboard | ✅ Yes | ✅ Yes |
| View All Profiles | ✅ Yes | ✅ Yes |
| Create New Artists | ✅ Yes | ✅ Yes |
| Edit Artist Profiles | ✅ Yes | ✅ Yes |
| Reset User Passwords | ✅ Yes | ✅ Yes |
| See Delete Button | ✅ Yes | ❌ No (Hidden) |
| Delete Artists | ✅ Yes | ❌ No (403 Error) |

---

## 🧪 Testing the System

### Test Full Admin (shubhamag1412@gmail.com)

1. **Login** with `shubhamag1412@gmail.com`
2. **Verify** Admin Dashboard button appears in frontend
3. **Open** Admin Dashboard
4. **Verify** you can see Delete buttons on all profiles
5. **Test** delete functionality works
6. **Confirm** deletion succeeds

### Test Admin Create (connectartistpushp@gmail.com)

1. **Login** with `connectartistpushp@gmail.com`
2. **Verify** Admin Dashboard button appears in frontend
3. **Open** Admin Dashboard
4. **Verify** you CANNOT see Delete buttons
5. **Test** creating a new artist works
6. **Test** editing an artist works
7. **Test** resetting password works
8. **Confirm** no delete option available

### Test Regular User

1. **Login** with any other Gmail account
2. **Verify** Admin Dashboard button does NOT appear
3. **Attempt** to access `/admin.html` directly
4. **Confirm** access is denied (requires admin role)

---

## 🔧 Files Modified

### 1. server.js (Lines 484-498)
```javascript
// Changed email from 'pushpshar1@gmail.com' to 'connectartistpushp@gmail.com'
if (emailLower === 'connectartistpushp@gmail.com') {
    user.role = 'admin-create';
    await user.save();
}
```

### 2. frontend.html (Line 1493)
```javascript
// Changed to show button for both admin roles
adminBtn.style.display = (user && (user.role === 'admin' || user.role === 'admin-create')) ? 'inline-block' : 'none';
```

### 3. admin.html (Line 544) - Already Correct
```javascript
// Delete button only shows for 'admin' role
${currentUserRole === 'admin' ? `<button class="btn btn-delete" onclick="deleteProfile('${profile._id}')">Delete</button>` : ''}
```

### 4. server.js (Lines 990-1010) - Already Correct
```javascript
// Permission check function already implemented
function checkAdminPermission(user, requiredPermission) {
  if (user.role === 'admin') return { hasPermission: true };
  if (user.role === 'admin-create') {
    const allowedPermissions = ['read', 'create', 'update', 'reset-password'];
    // 'delete' is NOT in allowedPermissions
  }
}
```

---

## 🎯 Key Points

### Why Two Roles?

1. **Security**: Prevent accidental deletions by limiting who can delete
2. **Delegation**: Allow trusted users to manage content without full control
3. **Audit Trail**: Know who can perform destructive actions
4. **Safety**: Reduce risk of data loss

### Role Hierarchy

```
admin (Full Admin)
  └── Can do EVERYTHING
      ├── View
      ├── Create
      ├── Update
      ├── Reset Password
      └── DELETE ⚠️

admin-create (Admin Create)
  └── Can do ALMOST everything
      ├── View
      ├── Create
      ├── Update
      ├── Reset Password
      └── ❌ CANNOT DELETE
```

### Permission Check Flow

```
User Action
    ↓
Frontend Check (Hide button if admin-create)
    ↓
User Attempts Action
    ↓
Backend Check (Verify role has permission)
    ↓
If role === 'admin' → Allow
If role === 'admin-create' → Check allowedPermissions
    ↓
If permission = 'delete' → DENY (403 Forbidden)
If permission in ['read','create','update','reset-password'] → Allow
```

---

## ✅ Summary

**Status: FULLY IMPLEMENTED** ✅

### What Works:
1. ✅ Both emails can access Admin Dashboard
2. ✅ shubhamag1412@gmail.com has full admin (including delete)
3. ✅ connectartistpushp@gmail.com has admin-create (no delete)
4. ✅ Delete button hidden for admin-create in UI
5. ✅ Delete blocked by backend for admin-create
6. ✅ All other features work for both roles

### Changes Made:
1. ✅ Updated server.js email from pushpshar1@gmail.com to connectartistpushp@gmail.com
2. ✅ Updated frontend.html to show Admin Dashboard button for both roles

### Already Implemented:
1. ✅ admin.html already hides delete button based on role
2. ✅ Backend permission check already blocks delete for admin-create
3. ✅ Role assignment system already working
4. ✅ Permission matrix already defined

---

**The system is now ready! Both admin accounts will work as specified.** 🎉
