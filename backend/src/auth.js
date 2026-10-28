import jwt from 'jsonwebtoken';
import 'dotenv/config';
export function authenticate(req,res,next){
 const header=req.headers.authorization;
 if(!header?.startsWith('Bearer ')) return res.status(401).json({error:'Authentication token required'});
 try { req.user=jwt.verify(header.slice(7),process.env.JWT_SECRET || 'local-dev-only-change-me'); next(); }
 catch { return res.status(401).json({error:'Token is invalid or expired'}); }
}
export const allowRoles=(...roles)=>(req,res,next)=>roles.includes(req.user?.role)?next():res.status(403).json({error:'Your role cannot perform this action'});
