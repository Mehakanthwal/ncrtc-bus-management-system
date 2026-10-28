import bcrypt from 'bcryptjs';
import { pool, query } from './db.js';
const passwordHash=await bcrypt.hash('Demo@12345',10);
try {
 await query(`INSERT INTO users(name,email,password_hash,role) VALUES
 ('Mehak Demo','admin@ncrtc.demo',$1,'admin'),
 ('Amit Sharma','driver@ncrtc.demo',$1,'driver'),
 ('Pooja Verma','pooja.driver@ncrtc.demo',$1,'driver'),
 ('Rahul Singh','rahul.driver@ncrtc.demo',$1,'driver'),
 ('Neha Yadav','neha.driver@ncrtc.demo',$1,'driver'),
 ('Karan Malik','karan.driver@ncrtc.demo',$1,'driver'),
 ('Deepak Kumar','deepak.driver@ncrtc.demo',$1,'driver'),
 ('Rajan Verma','manager@ncrtc.demo',$1,'depot_manager'),
 ('Kavita Singh','control@ncrtc.demo',$1,'control_operator'),
 ('Sana Khan','conductor@ncrtc.demo',$1,'conductor')
 ON CONFLICT(email) DO NOTHING`, [passwordHash]);
 await query(`INSERT INTO stops(name,latitude,longitude) VALUES
 ('Anand Vihar',28.6469,77.3160),('Sahibabad',28.6680,77.3390),('Ghaziabad',28.6692,77.4538),('Duhai',28.7540,77.4980),('Meerut',28.9845,77.7064),('Modinagar',28.8320,77.5740) ON CONFLICT DO NOTHING`);
 await query(`INSERT INTO routes(route_code,name,origin,destination,distance_km) VALUES
 ('R-01','Anand Vihar — Meerut','Anand Vihar','Meerut',58),('R-02','Sahibabad — Modinagar','Sahibabad','Modinagar',31),
 ('R-03','Ghaziabad — Duhai','Ghaziabad','Duhai',18),('R-04','Muradnagar — Duhai','Muradnagar','Duhai',14) ON CONFLICT(route_code) DO NOTHING`);
 const {rows: users}=await query('SELECT id,email FROM users'); const uid=Object.fromEntries(users.map(u=>[u.email,u.id]));
 const {rows: routes}=await query('SELECT id,route_code FROM routes'); const rid=Object.fromEntries(routes.map(r=>[r.route_code,r.id]));
 const sampleNames=['Amit Sharma','Pooja Verma','Rahul Singh','Neha Yadav','Karan Malik','Sana Khan'];
 for(let i=1;i<=50;i++){
  const code=`NCR-${String(100+i).padStart(3,'0')}`; const route=routes[(i-1)%routes.length];
  const lat=28.60+((i*17)%35)/100; const lng=77.20+((i*13)%55)/100;
  await query(`INSERT INTO vehicles(vehicle_code,registration_no,route_id,driver_id,status,speed_kmh,latitude,longitude)
   VALUES($1,$2,$3,$4,$5,$6,$7,$8) ON CONFLICT(vehicle_code) DO NOTHING`,[code,`DL-${String(1+(i%9)).padStart(2,'0')}-AB-${String(1000+i)}`,route?.id||null,uid['driver@ncrtc.demo'],i%13===0?'Maintenance':i%7===0?'At Stop':'On Route',i%7===0||i%13===0?0:25+(i*7)%35,lat,lng]);
 }
 const {rows: buses}=await query('SELECT id,vehicle_code,latitude,longitude,speed_kmh FROM vehicles ORDER BY id');
 for(const b of buses){ await query(`INSERT INTO gps_pings(vehicle_id,location,speed_kmh) SELECT $1,ST_SetSRID(ST_MakePoint($2,$3),4326)::geography,$4 WHERE NOT EXISTS(SELECT 1 FROM gps_pings WHERE vehicle_id=$1)`,[b.id,b.longitude,b.latitude,b.speed_kmh]); }
 await query(`INSERT INTO duties(duty_code,route_id,vehicle_id,driver_id,duty_date,shift_start,shift_end,status,created_by)
 SELECT 'DUT-SEED-'||v.id, v.route_id,v.id,$1,CURRENT_DATE,'06:00','14:00',CASE WHEN v.id%3=0 THEN 'Acknowledged' ELSE 'Published' END,$2 FROM vehicles v WHERE v.id<=8 ON CONFLICT(duty_code) DO NOTHING`,[uid['driver@ncrtc.demo'],uid['admin@ncrtc.demo']]);
 await query(`INSERT INTO incidents(incident_code,title,description,vehicle_id,location_text,severity,status,reported_by) VALUES
 ('INC-0081','Vehicle overheating reported','Vehicle moved to the depot for inspection.',(SELECT id FROM vehicles WHERE vehicle_code='NCR-104'),'Ghaziabad Depot','P1','In Progress',$1),
 ('INC-0080','Passenger complaint: delay','Service delay reported during morning peak.',(SELECT id FROM vehicles WHERE vehicle_code='NCR-102'),'Sahibabad Stop','P2','Acknowledged',$2),
 ('INC-0079','Stop display not working','Passenger information display needs checking.',(SELECT id FROM vehicles WHERE vehicle_code='NCR-103'),'Duhai Station','P3','Open',$1) ON CONFLICT(incident_code) DO NOTHING`,[uid['control@ncrtc.demo'],uid['manager@ncrtc.demo']]);
 await query(`INSERT INTO notices(notice_code,title,body,audience,status,created_by,published_at) VALUES
 ('NTC-021','Morning shift safety reminder','Complete the vehicle safety checklist before departure.','Drivers','Published',$1,NOW()),
 ('NTC-020','Depot operations meeting','Daily operations review at 4:00 PM.','Depot Managers','Published',$1,NOW()),
 ('NTC-019','Roster acknowledgement required','Please review and acknowledge your assigned duty roster.','All Staff','Draft',$1,NULL) ON CONFLICT(notice_code) DO NOTHING`,[uid['admin@ncrtc.demo']]);
 console.log('Seed complete. Demo password for all accounts: Demo@12345');
} catch(e){ console.error(e); process.exitCode=1; } finally { await pool.end(); }
