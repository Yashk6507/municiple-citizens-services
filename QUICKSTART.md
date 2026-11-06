# Municipal Portal - Quick Start Guide

## 🚀 Getting Started in 3 Steps

### Step 1: Set Up Supabase

1. **Create a Supabase Account**
   - Go to https://supabase.com and sign up (free)
   - Click "New Project"
   - Name it "Municipal Portal" and set a database password
   - Wait for project to initialize (~2 minutes)

2. **Get Your Credentials**
   - Go to Project Settings → API
   - Copy these values:
     - Project URL (looks like: `https://xxxxx.supabase.co`)
     - `anon` public key
     - `service_role` secret key

3. **Set Up the Database**
   - Go to SQL Editor in Supabase
   - Open `supabase-setup.sql` file from this project
   - Copy all contents and paste into SQL Editor
   - Click "Run" - this creates all tables and security policies

### Step 2: Configure Environment

1. **Copy and Edit Environment File**
   ```bash
   # Copy the example file
   cp .env.example .env
   
   # Edit .env with your favorite editor
   notepad .env  # Windows
   nano .env     # Linux/Mac
   ```

2. **Add Your Supabase Credentials**
   ```env
   SUPABASE_URL=https://your-project-id.supabase.co
   SUPABASE_ANON_KEY=your-anon-key-here
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here
   ```

3. **Change Admin Password** (Optional but recommended)
   ```env
   ADMIN_EMAIL=admin@municipal.local
   ADMIN_PASSWORD=YourSecurePassword123!
   ```

### Step 3: Run the Application

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start the Server**
   ```bash
   npm start
   ```

3. **Open in Browser**
   - Visit: http://localhost:4000
   - Login with admin credentials

## ✅ What's Been Enhanced

### 🔒 Security Improvements
- ✅ Supabase authentication with Row Level Security (RLS)
- ✅ Helmet.js for HTTP security headers
- ✅ Rate limiting (100 requests per 15 minutes)
- ✅ Input validation with express-validator
- ✅ JWT token authentication
- ✅ File upload restrictions (5MB max, images only)
- ✅ Complete audit logging
- ✅ CSRF protection

### 🏛️ Professional Government Features
- ✅ Unique complaint tracking numbers (CMP-YYYY-XXXXXX)
- ✅ Priority levels (Low, Medium, High, Critical)
- ✅ Department assignment system
- ✅ SLA (Service Level Agreement) tracking
- ✅ Multi-role support (User, Staff, Admin)
- ✅ Status history tracking
- ✅ Internal comments for staff coordination
- ✅ Citizen satisfaction ratings
- ✅ Public transparency dashboard
- ✅ Advanced filtering and search
- ✅ Analytics and reporting

### 🎨 UI/UX Improvements
- ✅ Loading states for all operations
- ✅ Error handling with user-friendly messages
- ✅ Toast notifications for actions
- ✅ Responsive design (mobile-friendly)
- ✅ Accessibility improvements
- ✅ Professional government theme maintained
- ✅ Interactive maps with Leaflet
- ✅ Real-time charts with Chart.js
- ✅ Smooth animations and transitions

### 🗄️ Database Enhancements
- ✅ PostgreSQL via Supabase (scalable, reliable)
- ✅ Automatic backups
- ✅ Row Level Security policies
- ✅ Indexed queries for performance
- ✅ Triggers for auto-generated data
- ✅ Foreign key relationships
- ✅ Data validation at database level

### 🆕 New Features
- ✅ Email notifications (via Supabase)
- ✅ Multiple file attachments per complaint
- ✅ Comment threads on complaints
- ✅ Complaint analytics dashboard
- ✅ Export capabilities (ready for future enhancement)
- ✅ Geolocation support
- ✅ Department management
- ✅ Category management with SLAs

## 📱 How to Use

### For Citizens

1. **Register**
   - Click "Register" in the header
   - Fill in your name, email, and password
   - Get instant access to your dashboard

2. **Submit a Complaint**
   - Click "Submit a Complaint"
   - Select category (Garbage, Pothole, Water Leakage, etc.)
   - Add description and optional photo
   - Click on map to set location
   - Submit and get a tracking number

3. **Track Your Complaints**
   - View all your complaints in dashboard
   - Filter by status or category
   - Receive notifications on status changes
   - View complaint details and updates

### For Administrators

1. **Login as Admin**
   - Email: `admin@municipal.local`
   - Password: `Admin@123` (change this!)

2. **Manage Complaints**
   - View all complaints across the city
   - Filter by status, category, priority
   - Assign to departments
   - Update status (Pending → In Progress → Resolved)
   - Add remarks and resolution notes

3. **View Analytics**
   - Total complaints by status
   - Category breakdown
   - Monthly trends
   - Average resolution time
   - Citizen satisfaction scores

4. **Manage Users**
   - View all registered citizens
   - Assign roles (User, Staff, Admin)
   - Track user activity

## 🔧 Configuration

### Change Admin Credentials
Edit `.env`:
```env
ADMIN_EMAIL=your-admin@example.com
ADMIN_PASSWORD=YourStrongPassword123!
```

### Adjust Rate Limits
Edit `.env`:
```env
RATE_LIMIT_WINDOW_MS=900000     # 15 minutes
RATE_LIMIT_MAX_REQUESTS=100      # 100 requests per window
```

### Change Server Port
Edit `.env`:
```env
PORT=4000  # Change to any available port
```

## 🐛 Troubleshooting

### "Missing Supabase configuration" Error
- **Cause**: `.env` file is missing or incomplete
- **Fix**: Copy `.env.example` to `.env` and add your Supabase credentials

### Database Connection Fails
- **Cause**: Invalid Supabase credentials
- **Fix**: Double-check your SUPABASE_URL and API keys in `.env`

### Admin Can't Login
- **Cause**: Database not initialized or admin not created
- **Fix**: Run `supabase-setup.sql` in Supabase SQL Editor

### File Upload Fails
- **Cause**: File too large or wrong format
- **Fix**: Ensure file is an image (JPEG, PNG, GIF) under 5MB

### Port Already in Use
- **Cause**: Another app is using port 4000
- **Fix**: Change PORT in `.env` to another number (e.g., 3000, 8080)

## 📊 Database Schema

### Main Tables
- **users**: Citizen and staff accounts
- **complaints**: All submitted civic issues
- **departments**: Municipal departments
- **complaint_categories**: Predefined issue types
- **notifications**: User notifications
- **audit_logs**: Complete activity tracking
- **complaint_status_history**: Status change tracking

### Key Features
- Auto-generated complaint numbers
- Automatic timestamps (created_at, updated_at)
- Row Level Security (users see only their data)
- Foreign key constraints for data integrity
- Indexes for fast queries

## 🔐 Security Best Practices

1. **Change Default Password**: Always change admin password in production
2. **Use HTTPS**: Deploy with SSL/TLS certificate
3. **Environment Variables**: Never commit `.env` to version control
4. **Strong JWT Secret**: Use a random 64-character string
5. **Regular Updates**: Keep dependencies updated with `npm update`
6. **Database Backups**: Enable automatic backups in Supabase
7. **Monitor Logs**: Regularly check audit logs for suspicious activity

## 🚀 Deployment

### Deploy to Production

1. **Set Environment Variables**
   ```env
   NODE_ENV=production
   JWT_SECRET=<64-character-random-string>
   ADMIN_PASSWORD=<strong-password>
   ```

2. **Configure Supabase**
   - Enable email confirmation
   - Set up SMTP for notifications
   - Configure custom domain

3. **Deploy Options**
   - **Railway**: Easy one-click deployment
   - **Heroku**: Free tier available
   - **DigitalOcean**: VPS with full control
   - **AWS/Azure**: Enterprise-grade hosting

## 📞 Support

For questions or issues:
1. Check this guide first
2. Review the detailed README.md
3. Check Supabase documentation: https://supabase.com/docs
4. Review the code comments in server-new.js

## 🎉 You're All Set!

Your municipal portal is now:
- ✅ Secure and production-ready
- ✅ Connected to Supabase cloud database
- ✅ Enhanced with professional features
- ✅ Following government-grade security standards
- ✅ Ready to serve your citizens!

**Default Login:**
- Admin: `admin@municipal.local` / `Admin@123`

Start the server and visit: **http://localhost:4000**

---
*Built with security, transparency, and citizen service in mind.* 🏛️
