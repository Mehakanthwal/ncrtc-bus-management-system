import express from 'express'; import cors from 'cors'; import helmet from 'helmet'; import rateLimit from 'express-rate-limit'; import bcrypt from 'bcryptjs'; import jwt from 'jsonwebtoken'; import 'dotenv/config';
import { query, pool } from './db.js'; import { authenticate, allowRoles } from './auth.js';
const app=express(); const PORT=Number(process.env.PORT||4000);
app.use(helmet()); app.use(cors({origin:process.env.CLIENT_ORIGIN||'http://localhost:5173'})); app.use(express.json({limit:'1mb'}));
app.use('/api/auth',rateLimit({windowMs:15*60*1000,max:60,standardHeaders:true,legacyHeaders:false}));
app.get('/api/health', async (_req, res) => {
  try {
    await query('SELECT 1');

    res.json({
      status: 'ok',
      database: 'connected',
      service: 'NCRTC BMS API'
    });
  } catch (error) {
    console.error('Database health check failed:', error);

    res.status(503).json({
      status: 'error',
      database: 'unavailable'
    });
  }
});app.post('/api/auth/login',async(req,res)=>{try{const {email,password}=req.body||{}; if(!email||!password)return res.status(400).json({error:'Email and password are required'}); const {rows}=await query('SELECT id,name,email,password_hash,role,depot FROM users WHERE LOWER(email)=LOWER($1) AND active=TRUE',[email]); const u=rows[0]; if(!u||!(await bcrypt.compare(password,u.password_hash)))return res.status(401).json({error:'Invalid email or password'}); const token=jwt.sign({id:u.id,name:u.name,email:u.email,role:u.role,depot:u.depot},process.env.JWT_SECRET||'local-dev-only-change-me',{expiresIn:process.env.JWT_EXPIRES_IN||'8h'});res.json({token,user:{id:u.id,name:u.name,email:u.email,role:u.role,depot:u.depot}});}catch(e){console.error(e);res.status(500).json({error:'Login failed'});}});
app.get('/api/auth/me',authenticate,(req,res)=>res.json({user:req.user}));
app.post('/api/auth/register',authenticate,allowRoles('admin'),async(req,res)=>{try{const {name,email,password,role='driver',depot='Delhi NCR Region'}=req.body||{};if(!name||!email||!password||password.length<8)return res.status(400).json({error:'Name, email and password (8+ characters) are required'});const allowed=['admin','driver','conductor','depot_manager','control_operator'];if(!allowed.includes(role))return res.status(400).json({error:'Invalid role'});const hash=await bcrypt.hash(password,10);const {rows}=await query('INSERT INTO users(name,email,password_hash,role,depot) VALUES($1,$2,$3,$4,$5) RETURNING id,name,email,role,depot',[name,email,hash,role,depot]);res.status(201).json(rows[0]);}catch(e){res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Email already exists':'Could not create user'});}});
app.use('/api',authenticate);
app.get('/api/dashboard',async(_req,res)=>{try{const [v,i,d,n]=await Promise.all([query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status='On Route')::int on_route,COUNT(*) FILTER(WHERE status='Maintenance')::int maintenance FROM vehicles`),query(`SELECT COUNT(*)::int total,COUNT(*) FILTER(WHERE status NOT IN ('Resolved','Closed'))::int open FROM incidents`),query(`SELECT COUNT(*)::int total FROM duties WHERE duty_date=CURRENT_DATE`),query(`SELECT COUNT(*)::int total FROM notices WHERE status='Published'`)]);res.json({vehicles:v.rows[0],incidents:i.rows[0],dutiesToday:d.rows[0].total,publishedNotices:n.rows[0].total});}catch(e){res.status(500).json({error:'Could not load dashboard'});}});
app.get('/api/vehicles',async(req,res)=>{try{const {rows}=await query(`SELECT v.id,v.vehicle_code AS code,v.registration_no,v.status,v.speed_kmh AS speed,v.latitude AS lat,v.longitude AS lng,v.last_seen,r.route_code,r.name AS route_name,u.name AS driver FROM vehicles v LEFT JOIN routes r ON r.id=v.route_id LEFT JOIN users u ON u.id=v.driver_id ORDER BY v.vehicle_code`);res.json(rows);}catch(e){res.status(500).json({error:'Could not load vehicles'});}});
app.patch('/api/vehicles/:id/status',allowRoles('admin','depot_manager','control_operator'),async(req,res)=>{const {status}=req.body||{};if(!['On Route','At Stop','Maintenance','Out of Service'].includes(status))return res.status(400).json({error:'Invalid vehicle status'});try{const {rows}=await query('UPDATE vehicles SET status=$1,last_seen=NOW() WHERE id=$2 RETURNING *',[status,req.params.id]);if(!rows[0])return res.status(404).json({error:'Vehicle not found'});res.json(rows[0]);}catch{res.status(500).json({error:'Could not update vehicle'});}});
app.get('/api/routes',async(_req,res)=>{const {rows}=await query(`SELECT r.*,COUNT(rs.stop_id)::int AS stop_count FROM routes r LEFT JOIN route_stops rs ON rs.route_id=r.id GROUP BY r.id ORDER BY r.route_code`);res.json(rows);});
app.post('/api/routes',allowRoles('admin','depot_manager'),async(req,res)=>{const {route_code,name,origin,destination,distance_km=0}=req.body||{};if(!route_code||!name||!origin||!destination)return res.status(400).json({error:'Route code, name, origin and destination are required'});try{const {rows}=await query('INSERT INTO routes(route_code,name,origin,destination,distance_km) VALUES($1,$2,$3,$4,$5) RETURNING *',[route_code,name,origin,destination,Number(distance_km)||0]);res.status(201).json(rows[0]);}catch(e){res.status(e.code==='23505'?409:500).json({error:e.code==='23505'?'Route code already exists':'Could not create route'});}});
app.get('/api/duties',async(_req,res)=>{const {rows}=await query(`SELECT d.id,d.duty_code,d.duty_date,d.shift_start,d.shift_end,d.status,v.vehicle_code AS vehicle,r.route_code,r.name AS route_name,u.name AS driver FROM duties d LEFT JOIN vehicles v ON v.id=d.vehicle_id LEFT JOIN routes r ON r.id=d.route_id LEFT JOIN users u ON u.id=d.driver_id ORDER BY d.duty_date DESC,d.id DESC`);res.json(rows);});
app.post('/api/duties',allowRoles('admin','depot_manager','control_operator'),async(req,res)=>{const {duty_code,route_id,vehicle_id,driver_id,duty_date,shift_start,shift_end,status='Draft'}=req.body||{};if(!duty_code||!route_id||!vehicle_id||!driver_id||!duty_date||!shift_start||!shift_end)return res.status(400).json({error:'Complete all required duty fields'});try{const {rows}=await query(`INSERT INTO duties(duty_code,route_id,vehicle_id,driver_id,duty_date,shift_start,shift_end,status,created_by) VALUES($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,[duty_code,route_id,vehicle_id,driver_id,duty_date,shift_start,shift_end,status,req.user.id]);res.status(201).json(rows[0]);}catch(e){res.status(e.code==='23505'?409:400).json({error:e.code==='23505'?'Duty code already exists':'Could not create duty; check the selected route, vehicle and driver'});}});
app.patch('/api/duties/:id/status',async(req,res)=>{const allowed=req.user.role==='driver'?['Acknowledged']:['Draft','Published','Acknowledged','Completed'];const {status}=req.body||{};if(!allowed.includes(status))return res.status(403).json({error:'This role cannot set that duty status'});try{const {rows}=await query('UPDATE duties SET status=$1 WHERE id=$2 RETURNING *',[status,req.params.id]);if(!rows[0])return res.status(404).json({error:'Duty not found'});res.json(rows[0]);}catch{res.status(500).json({error:'Could not update duty'});}});

app.get('/api/incidents', async (_req, res) => {
  try {
    const { rows } = await query(`
      SELECT
        i.*,
        v.vehicle_code AS vehicle,
        u.name AS reporter
      FROM incidents i
      LEFT JOIN vehicles v ON v.id = i.vehicle_id
      LEFT JOIN users u ON u.id = i.reported_by
      ORDER BY i.created_at DESC
    `);

    res.json(rows);
  } catch (error) {
    console.error('GET incidents error:', error);
    res.status(500).json({ error: 'Could not fetch incidents' });
  }
});


app.post('/api/incidents', async (req, res) => {
  const {
    title,
    description,
    vehicle_id,
    location_text,
    severity = 'P2'
  } = req.body || {};

  if (!title || !description || !location_text) {
    return res.status(400).json({
      error: 'Title, description and location are required'
    });
  }

  if (!['P1', 'P2', 'P3'].includes(severity)) {
    return res.status(400).json({ error: 'Invalid severity' });
  }

  try {
    const code = `INC-${Date.now().toString().slice(-8)}`;

    const { rows } = await query(
      `INSERT INTO incidents (
        incident_code,
        title,
        description,
        vehicle_id,
        location_text,
        severity,
        reported_by
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      RETURNING *`,
      [
        code,
        title,
        description,
        vehicle_id || null,
        location_text,
        severity,
        req.user.id
      ]
    );

    await query(
      `INSERT INTO incident_events (
        incident_id,
        actor_id,
        event_type,
        note
      )
      VALUES ($1, $2, $3, $4)`,
      [rows[0].id, req.user.id, 'Created', description]
    );

    res.status(201).json(rows[0]);
  } catch (error) {
    console.error('POST incident error:', error);
    res.status(500).json({ error: 'Could not create incident' });
  }
});


app.patch(
  '/api/incidents/:id/status',
  allowRoles('admin', 'depot_manager', 'control_operator'),
  async (req, res) => {
    const { status, note = '' } = req.body || {};

    if (
      !['Open', 'Acknowledged', 'In Progress', 'Resolved', 'Closed']
        .includes(status)
    ) {
      return res.status(400).json({ error: 'Invalid incident status' });
    }

    try {
      const { rows } = await query(
        `UPDATE incidents
         SET status = $1::text,
             updated_at = NOW()
         WHERE id = $2
         RETURNING *`,
        [status, req.params.id]
      );

      if (!rows[0]) {
        return res.status(404).json({ error: 'Incident not found' });
      }

      await query(
        `INSERT INTO incident_events (
          incident_id,
          actor_id,
          event_type,
          note
        )
        VALUES ($1, $2, $3, $4)`,
        [req.params.id, req.user.id, status, note]
      );

      res.json(rows[0]);
    } catch (error) {
      console.error('PATCH incident status error:', error);
      res.status(500).json({ error: 'Could not update incident' });
    }
  }
);


app.get('/api/incidents/:id/events', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
        e.*,
        u.name AS actor
       FROM incident_events e
       LEFT JOIN users u ON u.id = e.actor_id
       WHERE e.incident_id = $1
       ORDER BY e.created_at`,
      [req.params.id]
    );

    res.json(rows);
  } catch (error) {
    console.error('GET incident events error:', error);
    res.status(500).json({ error: 'Could not fetch incident events' });
  }
});


app.get('/api/notices', async (req, res) => {
  try {
    const { rows } = await query(
      `SELECT
        n.*,
        u.name AS author,
        (
          SELECT COUNT(*)::int
          FROM notice_reads nr
          WHERE nr.notice_id = n.id
        ) AS read_count
       FROM notices n
       LEFT JOIN users u ON u.id = n.created_by
       WHERE n.status = 'Published'
          OR $1::varchar IN (
            'admin',
            'depot_manager',
            'control_operator'
          )
       ORDER BY n.created_at DESC`,
      [req.user.role]
    );

    res.json(rows);
  } catch (error) {
    console.error('GET notices error:', error);
    res.status(500).json({ error: 'Could not fetch notices' });
  }
});


app.post(
  '/api/notices',
  allowRoles('admin', 'depot_manager', 'control_operator'),
  async (req, res) => {
    const {
      title,
      body,
      audience = 'All Staff',
      status = 'Draft'
    } = req.body || {};

    if (!title || !body) {
      return res.status(400).json({
        error: 'Title and message are required'
      });
    }

    const allowedAudiences = [
      'All Staff',
      'Drivers',
      'Conductors',
      'Depot Managers',
      'Control Operators'
    ];

    if (!allowedAudiences.includes(audience)) {
      return res.status(400).json({ error: 'Invalid audience' });
    }

    if (!['Draft', 'Published', 'Archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid notice status' });
    }

    try {
      const code = `NTC-${Date.now().toString().slice(-7)}`;

      const { rows } = await query(
        `INSERT INTO notices (
          notice_code,
          title,
          body,
          audience,
          status,
          created_by,
          published_at
        )
        VALUES ($1, $2, $3, $4, $5, $6,
                CASE WHEN $7::boolean
                     THEN NOW()
                     ELSE NULL
                END)
        RETURNING *`,
        [
          code,
          title,
          body,
          audience,
          status,
          req.user.id,
          status === 'Published'
        ]
      );

      res.status(201).json(rows[0]);
    } catch (error) {
      console.error('POST notice error:', error);
      res.status(500).json({ error: 'Could not create notice' });
    }
  }
);


app.patch(
  '/api/notices/:id/status',
  allowRoles('admin', 'depot_manager', 'control_operator'),
  async (req, res) => {
    const { status } = req.body || {};

    if (!['Draft', 'Published', 'Archived'].includes(status)) {
      return res.status(400).json({ error: 'Invalid notice status' });
    }

    try {
      const { rows } = await query(
        `UPDATE notices
         SET status = $1,
             published_at = CASE
               WHEN $2::boolean
               THEN COALESCE(published_at, NOW())
               ELSE published_at
             END
         WHERE id = $3
         RETURNING *`,
        [
          status,
          status === 'Published',
          req.params.id
        ]
      );

      if (!rows[0]) {
        return res.status(404).json({ error: 'Notice not found' });
      }

      res.json(rows[0]);
    } catch (error) {
      console.error('PATCH notice status error:', error);
      res.status(500).json({ error: 'Could not update notice status' });
    }
  }
);


app.post('/api/notices/:id/read', async (req, res) => {
  try {
    await query(
      `INSERT INTO notice_reads (notice_id, user_id)
       VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [req.params.id, req.user.id]
    );

    res.json({ success: true });
  } catch (error) {
    console.error('POST notice read error:', error);
    res.status(500).json({ error: 'Could not mark notice as read' });
  }
});

app.get('/api/users',allowRoles('admin','depot_manager'),async(_req,res)=>{const {rows}=await query('SELECT id,name,email,role,depot,active,created_at FROM users ORDER BY name');res.json(rows);});
app.use((err,_req,res,_next)=>{console.error(err);res.status(500).json({error:'Unexpected server error'});});
const server=app.listen(PORT,()=>console.log(`NCRTC API listening on http://localhost:${PORT}`));
process.on('SIGINT',async()=>{server.close();await pool.end();process.exit(0);});
