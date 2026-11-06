# Deployment Guide - Municipal Portal

## Quick Deployment Checklist

- [ ] Supabase account created and project set up
- [ ] Database schema deployed (supabase-setup.sql)
- [ ] .env file configured with production values
- [ ] Strong JWT_SECRET generated
- [ ] Admin password changed from default
- [ ] Dependencies installed (`npm install`)
- [ ] Server tested locally (`npm start`)
- [ ] HTTPS/SSL certificate configured
- [ ] Domain name pointed to server
- [ ] Email notifications configured in Supabase
- [ ] Backups enabled in Supabase

## Step-by-Step Deployment

### 1. Prepare Supabase (Production Database)

1. **Create Production Project**
   - Go to https://supabase.com
   - Create a new project (use a strong database password)
   - Choose a region close to your users
   - Wait for project initialization

2. **Deploy Database Schema**
   - Open SQL Editor in Supabase
   - Copy entire contents of `supabase-setup.sql`
   - Run the SQL script
   - Verify all tables are created in Table Editor

3. **Configure Authentication**
   - Go to Authentication → Settings
   - Set Site URL to your production domain
   - Configure email templates
   - Enable email confirmation if desired
   - Set up SMTP for emails (optional but recommended)

4. **Enable Database Backups**
   - Go to Database → Backups
   - Enable automatic daily backups
   - Test backup/restore process

### 2. Configure Environment Variables

Create a production `.env` file with secure values:

```env
# Production Configuration
NODE_ENV=production
PORT=4000

# Generate a strong random secret (64 characters)
# Use: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
JWT_SECRET=your_very_long_random_secret_here_64_characters_minimum

# Supabase Production Credentials
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-production-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-production-service-role-key

# Admin Account (Change these!)
ADMIN_EMAIL=admin@yourmunicipal.gov
ADMIN_PASSWORD=VeryStrongPassword123!@#

# Rate Limiting (adjust based on your needs)
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
```

**Generate Strong JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

### 3. Deployment Options

#### Option A: Railway (Recommended - Easiest)

1. **Install Railway CLI**
   ```bash
   npm install -g @railway/cli
   ```

2. **Login and Initialize**
   ```bash
   railway login
   railway init
   ```

3. **Add Environment Variables**
   ```bash
   railway variables set JWT_SECRET="your-secret"
   railway variables set SUPABASE_URL="your-url"
   railway variables set SUPABASE_ANON_KEY="your-key"
   railway variables set SUPABASE_SERVICE_ROLE_KEY="your-service-key"
   railway variables set ADMIN_EMAIL="your-admin@email.com"
   railway variables set ADMIN_PASSWORD="your-password"
   ```

4. **Deploy**
   ```bash
   railway up
   ```

5. **Get Your URL**
   ```bash
   railway domain
   ```

#### Option B: Heroku

1. **Install Heroku CLI**
   - Download from https://devcenter.heroku.com/articles/heroku-cli

2. **Login and Create App**
   ```bash
   heroku login
   heroku create your-municipal-portal
   ```

3. **Set Environment Variables**
   ```bash
   heroku config:set NODE_ENV=production
   heroku config:set JWT_SECRET="your-secret"
   heroku config:set SUPABASE_URL="your-url"
   heroku config:set SUPABASE_ANON_KEY="your-key"
   heroku config:set SUPABASE_SERVICE_ROLE_KEY="your-service-key"
   heroku config:set ADMIN_EMAIL="your-admin@email.com"
   heroku config:set ADMIN_PASSWORD="your-password"
   ```

4. **Deploy**
   ```bash
   git add .
   git commit -m "Deploy municipal portal"
   git push heroku main
   ```

5. **Open Your App**
   ```bash
   heroku open
   ```

#### Option C: DigitalOcean Droplet (VPS)

1. **Create Droplet**
   - Go to DigitalOcean
   - Create Ubuntu 22.04 droplet
   - Minimum: 1GB RAM, 1 vCPU
   - Add SSH key

2. **Connect to Server**
   ```bash
   ssh root@your-server-ip
   ```

3. **Install Node.js**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   apt-get install -y nodejs
   apt-get install -y git
   ```

4. **Clone and Setup**
   ```bash
   cd /var/www
   git clone your-repo-url municipal-portal
   cd municipal-portal
   npm install --production
   ```

5. **Create .env File**
   ```bash
   nano .env
   # Add all production environment variables
   ```

6. **Install PM2 (Process Manager)**
   ```bash
   npm install -g pm2
   pm2 start server-new.js --name municipal-portal
   pm2 startup
   pm2 save
   ```

7. **Configure Nginx**
   ```bash
   apt-get install -y nginx
   nano /etc/nginx/sites-available/municipal-portal
   ```

   Add configuration:
   ```nginx
   server {
       listen 80;
       server_name yourdomain.com;

       location / {
           proxy_pass http://localhost:4000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

   Enable site:
   ```bash
   ln -s /etc/nginx/sites-available/municipal-portal /etc/nginx/sites-enabled/
   nginx -t
   systemctl restart nginx
   ```

8. **Install SSL Certificate (Free with Let's Encrypt)**
   ```bash
   apt-get install -y certbot python3-certbot-nginx
   certbot --nginx -d yourdomain.com
   ```

#### Option D: AWS EC2

Similar to DigitalOcean, but:
1. Create EC2 instance (t2.micro for free tier)
2. Configure Security Groups (allow ports 80, 443, 22)
3. Follow DigitalOcean steps above
4. Configure Route 53 for DNS (optional)

### 4. Configure Domain

1. **Point Domain to Server**
   - If using Railway/Heroku: Use their custom domain feature
   - If using VPS: Update A record to point to server IP

2. **DNS Records**
   ```
   Type: A
   Name: @
   Value: your-server-ip
   TTL: 3600
   ```

### 5. Configure HTTPS/SSL

#### For Railway/Heroku
- Automatic HTTPS enabled

#### For VPS (using Let's Encrypt)
```bash
certbot --nginx -d yourdomain.com -d www.yourdomain.com
```

#### For Cloudflare (Optional)
- Add site to Cloudflare
- Update nameservers
- Enable "Always Use HTTPS"
- Enable "Automatic HTTPS Rewrites"

### 6. Post-Deployment Configuration

1. **Test the Application**
   - Visit your production URL
   - Register a test account
   - Submit a test complaint
   - Login as admin and verify access

2. **Update Supabase Settings**
   - Add production URL to allowed origins
   - Configure email redirects
   - Set up webhooks if needed

3. **Configure Monitoring**
   - Set up Supabase dashboard alerts
   - Configure server monitoring (UptimeRobot, etc.)
   - Set up error logging (Sentry, LogRocket, etc.)

4. **Change Default Admin Password**
   - Login as admin
   - Update password in application
   - Update .env file if needed

### 7. Security Hardening

1. **Firewall Configuration** (VPS only)
   ```bash
   ufw allow 22
   ufw allow 80
   ufw allow 443
   ufw enable
   ```

2. **Disable Root Login** (VPS only)
   ```bash
   adduser deploy
   usermod -aG sudo deploy
   # Edit /etc/ssh/sshd_config
   # Set: PermitRootLogin no
   systemctl restart sshd
   ```

3. **Keep System Updated**
   ```bash
   apt-get update && apt-get upgrade -y
   ```

4. **Configure Fail2Ban** (VPS only)
   ```bash
   apt-get install -y fail2ban
   systemctl enable fail2ban
   ```

### 8. Monitoring & Maintenance

1. **Server Monitoring**
   - Railway: Built-in metrics
   - Heroku: Use Heroku metrics
   - VPS: Install monitoring agent

2. **Database Monitoring**
   - Use Supabase dashboard
   - Monitor query performance
   - Check storage usage

3. **Application Logs**
   ```bash
   # PM2 logs (VPS)
   pm2 logs municipal-portal
   
   # Railway logs
   railway logs
   
   # Heroku logs
   heroku logs --tail
   ```

4. **Regular Backups**
   - Verify Supabase automatic backups
   - Export database weekly
   - Backup uploaded files

### 9. Performance Optimization

1. **Enable Gzip Compression** (Nginx)
   ```nginx
   gzip on;
   gzip_types text/plain text/css application/json application/javascript;
   ```

2. **Cache Static Assets**
   ```nginx
   location ~* \.(jpg|jpeg|png|gif|ico|css|js)$ {
       expires 1y;
       add_header Cache-Control "public, immutable";
   }
   ```

3. **Database Optimization**
   - Review slow queries in Supabase
   - Add indexes if needed
   - Enable connection pooling

4. **CDN (Optional)**
   - Use Cloudflare for static assets
   - Configure caching rules

### 10. Troubleshooting

**Server Won't Start**
- Check .env file exists and is readable
- Verify all environment variables are set
- Check port isn't already in use
- Review server logs for errors

**Database Connection Fails**
- Verify Supabase credentials
- Check network connectivity
- Verify IP whitelist in Supabase (if enabled)

**Authentication Issues**
- Check JWT_SECRET is set
- Verify token expiration settings
- Clear browser localStorage

**File Upload Issues**
- Check uploads directory exists and is writable
- Verify disk space available
- Check file size limits

## Production Checklist

Before going live:
- [ ] All environment variables are set
- [ ] Default admin password changed
- [ ] HTTPS/SSL certificate active
- [ ] Database backups enabled
- [ ] Rate limiting configured
- [ ] Error logging set up
- [ ] Monitoring configured
- [ ] Domain name configured
- [ ] Email notifications working
- [ ] All test cases passed
- [ ] Security audit completed
- [ ] Documentation updated
- [ ] Team trained on admin panel
- [ ] Support contact info added

## Scaling Considerations

As your portal grows:

1. **Upgrade Supabase Plan**
   - More storage
   - Higher connection limits
   - Better performance

2. **Scale Server**
   - Increase RAM/CPU
   - Add load balancer
   - Multiple server instances

3. **Optimize Database**
   - Add more indexes
   - Archive old data
   - Optimize queries

4. **Add Redis Caching**
   - Cache frequent queries
   - Session storage
   - Rate limiting

## Support

After deployment, ensure you have:
- Admin access credentials stored securely
- Backup contact for Supabase account
- Documentation for maintenance procedures
- Support contact for citizens

---

**Congratulations! Your municipal portal is now live and serving citizens.** 🎉

For issues or questions, refer to:
- README.md - Complete documentation
- QUICKSTART.md - Setup guide
- Supabase docs - https://supabase.com/docs
