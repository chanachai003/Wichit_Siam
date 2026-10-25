import jwt from 'jsonwebtoken';
import db from '../db.js';

// ตรวจสอบ JWT และโหลดข้อมูล user ปัจจุบันจาก DB
export default async function auth(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader) {
    return res.status(401).json({ message: 'ไม่มี token' });
  }

  const parts = authHeader.split(' ');

  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return res.status(401).json({ message: 'Authorization header ไม่ถูกต้อง' });
  }

  const token = parts[1];

  let decoded;
  try {
    decoded = jwt.verify(token, process.env.JWT_SECRET);
  } catch (err) {
    return res.status(403).json({ message: 'token ไม่ถูกต้อง' });
  }

  try {
    const result = await db.query(
      'SELECT id, username, role FROM users WHERE id = $1',
      [decoded.id]
    );
    const user = result.rows[0];

    if (!user) {
      return res.status(401).json({ message: 'User ไม่พบ' });
    }

    req.user = user;
    next();
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Internal Server Error' });
  }
}