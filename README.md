# Municipal Civic Issue Reporting Portal

A professional government-grade web application for citizens to report and track civic issues such as potholes, garbage collection, water leakage, and streetlight failures. Built with modern security practices and integrated with Supabase for scalable database management.

## Features

### For Citizens
- **Report Issues**: Submit complaints with photos, location, and detailed descriptions
- **Track Status**: Real-time tracking of complaint status (Pending → In Progress → Resolved)
- **Map Integration**: Interactive map for pinpointing exact locations using Leaflet
- **Notifications**: Receive updates when complaint status changes
- **Dashboard**: View all your complaints and their current status
- **Mobile Friendly**: Fully responsive design for mobile and desktop

### For Administrators
- **Complaint Management**: View, assign, and update all complaints
- **Priority Levels**: Set priority (Low, Medium, High, Critical) for complaints
- **Department Assignment**: Assign complaints to specific departments
- **Analytics Dashboard**: Real-time statistics and trends
- **User Management**: Manage user accounts and roles
- **Audit Logs**: Complete audit trail of all actions
- **SLA Tracking**: Monitor resolution times and service level agreements
- **Advanced Filters**: Filter by status, category, priority, department

### Security Features
- Secure authentication with Supabase Auth
- JWT token-based authorization
- Rate limiting to prevent abuse
- Input validation and sanitization
- Helmet.js security headers
- Row Level Security (RLS) in database
- File upload restrictions (images only, 5MB max)
- Audit logging for all critical operations

### Professional Government Features
- Unique complaint tracking numbers (CMP-YYYY-XXXXXX format)
- Department-wise routing
- SLA (Service Level Agreement) tracking
- Citizen satisfaction ratings
- Public transparency dashboard
- Multi-user role support (User, Staff, Admin)
- Status history tracking
- Internal comments for staff coordination

## Technology Stack

- **Backend**: Node.js with Express.js
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth + JWT
- **Frontend**: Vanilla JavaScript with modern CSS
- **Maps**: Leaflet.js with OpenStreetMap
- **Charts**: Chart.js
- **Security**: Helmet.js, Express Rate Limit, Express Validator

## Prerequisites

- Node.js (v14 or higher)
- npm or yarn
- Supabase account (free tier available at https://supabase.com)

## Installation & Setup

### 1. Clone or Download the Project

```bash
cd C:\munciple
```

### 2. Install Dependencies

```bash
npm install
```

### 3. Set Up Supabase

1. Create a free account at [Supabase](https://supabase.com)
2. Create a new project
3. Go to Project Settings → API
4. Copy your project URL and API keys

### 4. Configure Environment Variables

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```env
PORT=4000
NODE_ENV=production

# JWT Secret - Generate a strong random string
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production

# Supabase Configuration
SUPABASE_URL=https://your-project-id.supabase.co
SUPABASE_ANON_KEY=your-anon-key-here
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key-here

# Admin Configuration
ADMIN_EMAIL=admin@municipal.local
ADMIN_PASSWORD=ChangeThisPassword123!

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

### 5. Set Up the Database

1. Open your Supabase project dashboard
2. Go to the SQL Editor
3. Copy the contents of `supabase-setup.sql`
4. Paste and run the SQL script

This will create all necessary tables, indexes, triggers, and security policies.

### 6. Start the Server

```bash
npm start
```

The server will start on `http://localhost:4000`

## Default Login Credentials

**Administrator Account:**
- Email: `admin@municipal.local` (or as configured in .env)
- Password: `Admin@123` (or as configured in .env)

**Important**: Change the default admin password immediately after first login!

## Project Structure

```
C:\munciple\
├── public/
│   ├── index.html          # Main HTML file
│   ├── app.js              # Frontend JavaScript
│   └── styles.css          # Styling
├── uploads/                # User-uploaded complaint images
├── data/                   # SQLite database (legacy, not used with Supabase)
├── supabase.js             # Supabase client configuration
├── server-new.js           # Enhanced server with Supabase
├── server.js               # Legacy SQLite server (backup)
├── db.js                   # Legacy SQLite config (backup)
├── supabase-setup.sql      # Database schema for Supabase
├── .env                    # Environment configuration (create from .env.example)
├── .env.example            # Example environment variables
├── package.json            # Node.js dependencies
└── README.md               # This file
```

## API Endpoints

### Public Endpoints
- `GET /api/public/overview` - Public statistics and recent resolved complaints

### Authentication
- `POST /api/auth/register` - Register new citizen account
- `POST /api/auth/login` - Login
- `GET /api/auth/me` - Get current user profile

### Complaints
- `POST /api/complaints` - Submit new complaint (authenticated)
- `GET /api/complaints` - List complaints (user sees own, admin sees all)
- `GET /api/complaints/:id` - Get complaint details
- `PATCH /api/complaints/:id` - Update complaint (admin only)

### Notifications
- `GET /api/notifications` - Get user notifications
- `POST /api/notifications/:id/read` - Mark notification as read

### Admin
- `GET /api/users` - List all users (admin only)
- `PATCH /api/users/:id` - Update user role (admin only)
- `GET /api/complaints/stats/overview` - Get statistics (admin only)

### Reference Data
- `GET /api/departments` - List departments
- `GET /api/categories` - List complaint categories

## Database Schema Highlights

### Tables
- `users` - User accounts with roles
- `complaints` - Citizen complaints with full details
- `departments` - Municipal departments
- `complaint_categories` - Predefined complaint types
- `complaint_status_history` - Track all status changes
- `notifications` - User notifications
- `complaint_comments` - Comments and updates
- `audit_logs` - Complete audit trail
- `complaint_attachments` - Multiple file attachments

### Security (Row Level Security)
- Users can only view/edit their own data
- Admins and staff bypass RLS for management
- Public data is accessible without authentication
- All sensitive operations are logged

## Configuration Options

### Rate Limiting
Adjust in `.env`:
- `RATE_LIMIT_WINDOW_MS` - Time window in milliseconds (default: 15 minutes)
- `RATE_LIMIT_MAX_REQUESTS` - Max requests per window (default: 100)

### File Uploads
Configure in `server-new.js`:
- Max file size: 5MB
- Allowed types: JPEG, JPG, PNG, GIF, WEBP

### JWT Tokens
- Expiration: 7 days (configurable in server)
- Algorithm: HS256

## Deployment

### Environment Variables for Production
Ensure these are set:
- `NODE_ENV=production`
- Strong `JWT_SECRET` (use a random 64-character string)
- Update `ADMIN_PASSWORD` to a strong password
- Configure proper CORS origins in server

### Supabase Production Settings
1. Enable email confirmation in Supabase Auth settings
2. Configure SMTP for email notifications
3. Set up database backups
4. Review and adjust RLS policies
5. Enable SSL/TLS

### Server Deployment Options
- **VPS/Cloud**: Deploy on AWS, DigitalOcean, Azure, or similar
- **Platform as a Service**: Deploy on Heroku, Railway, Render
- **Containerization**: Use Docker for easy deployment

## Maintenance

### Database Backups
Supabase provides automatic backups. You can also:
1. Go to Database → Backups in Supabase dashboard
2. Download manual backups regularly

### Monitoring
- Check Supabase dashboard for database performance
- Monitor server logs for errors
- Review audit logs regularly

### Updates
Keep dependencies updated:
```bash
npm audit
npm update
```

## Troubleshooting

### "Missing Supabase configuration" Error
- Ensure `.env` file exists and contains valid Supabase credentials
- Check that environment variables are loaded correctly

### Database Connection Issues
- Verify Supabase URL and API keys are correct
- Check if your IP is whitelisted in Supabase (if restrictions enabled)
- Ensure database tables are created (run supabase-setup.sql)

### File Upload Errors
- Check that `uploads/` directory exists and is writable
- Verify file size is under 5MB
- Ensure file type is an allowed image format

### Authentication Issues
- Clear browser localStorage
- Check JWT_SECRET matches between sessions
- Verify token hasn't expired (7-day default)

## Migration from SQLite to Supabase

If you have existing data in the SQLite database:

1. Export data from SQLite
2. Transform to match Supabase schema
3. Import into Supabase tables
4. Update `.env` to use Supabase
5. Switch to `server-new.js`

A migration script can be created if needed.

## Support & Contributing

For issues, questions, or contributions:
- Review the code and documentation
- Check Supabase documentation for database queries
- Test changes in development before production

## Security Considerations

- Never commit `.env` file to version control
- Rotate JWT_SECRET regularly in production
- Use strong passwords for admin accounts
- Enable 2FA in Supabase dashboard
- Regularly review audit logs
- Keep dependencies updated
- Use HTTPS in production

## License

MIT License - Free to use for municipal and government purposes.

## Acknowledgments

- Leaflet.js for mapping functionality
- Chart.js for data visualization
- Supabase for backend infrastructure
- OpenStreetMap contributors

---

**Built for professional government use with security, transparency, and citizen service in mind.**
