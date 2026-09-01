import db from './db';

export function seedData() {
  const userCount = (db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number }).count;
  
  if (userCount === 0) {
    console.log("Seeding initial users...");
    const insertUser = db.prepare(`
      INSERT OR IGNORE INTO users (id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const defaultUsers = [
      ['prime', 'Prime Admin', 'zzz', 'superuser', 'A', 'CMN', 'Day Shift', 2],
      ['COM001', 'Kari Pienimäki', 'Metso', 'Commissioning Director', 'A', 'CMN', 'Day Shift', 2],
      ['COM004', 'Jukka Tuominen', 'Metso', 'Comm. Lead Advisor (Deputy)', 'B', 'SM', 'Day Shift', 3],
      ['COM006', 'Vivek Agarwal', 'Metso', 'Process Lead Advisor', 'A', 'ET', 'Day Shift', 2],
      ['COM008', 'Satu Jyrkänen', 'Metso', 'Process Area Commissioning Lead Advisor', 'A', 'SM', 'Day Shift', 2],
      ['COM116', 'Iqlima Nur Hayati', 'Metso', 'Site Admin', 'A', 'CMN', 'Day Shift', 2],
      ['COM200', 'Andre Mailoa', 'Metso', 'Equipment Expert', 'B', 'CMN', 'Day Shift', 2],
    ];

    for (const user of defaultUsers) {
      try {
        insertUser.run(...user);
      } catch (e) {}
    }
  } else {
    // Ensure 'prime' superuser exists
    const primeUser = db.prepare('SELECT id FROM users WHERE id = ?').get('prime');
    if (!primeUser) {
      try {
        db.prepare(`
          INSERT OR IGNORE INTO users (id, username, password, role, grade, preferred_areas, preferred_shift, number_of_areas)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `).run('prime', 'Prime Admin', 'zzz', 'superuser', 'A', 'CMN', 'Day Shift', 2);
      } catch (e) {}
    }
  }

  // Ensure default areas are seeded (GCP, SAP, ER, SM, SC, CMN, ET)
  const defaultAreas = ['GCP', 'SAP', 'ER', 'SM', 'SC', 'CMN', 'ET'];
  const insertArea = db.prepare('INSERT OR IGNORE INTO areas (name) VALUES (?)');
  for (const area of defaultAreas) {
    insertArea.run(area);
  }
}

seedData();
