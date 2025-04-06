// Import database libraries (Postgres client)
import { Pool } from 'pg';

// Create a single database connection pool that can be reused
let pool: Pool | null = null;

// Initialize the database connection
export function getDb() {
  if (!pool) {
    // Create a new pool using the connection string from environment variables
    const connectionString = process.env.POSTGRES_URL;
    
    if (!connectionString) {
      throw new Error('Database connection string not found in environment variables');
    }
    
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false, // Needed for some PostgreSQL providers like Neon
      },
    });
  }
  
  return pool;
}

// For document storage and retrieval
export async function storeDocumentInfo(
  userId: string, 
  docId: string, 
  fileName: string, 
  fileType: string, 
  summary: string
) {
  const db = getDb();
  
  try {
    // Insert document info into the database
    const result = await db.query(
      `INSERT INTO documents (user_id, doc_id, file_name, file_type, summary, created_at)
       VALUES ($1, $2, $3, $4, $5, NOW())
       RETURNING *`,
      [userId, docId, fileName, fileType, summary]
    );
    
    return result.rows[0];
  } catch (error) {
    console.error('Error storing document info:', error);
    throw error;
  }
}

// For retrieving document information
export async function getDocumentById(docId: string) {
  const db = getDb();
  
  try {
    const result = await db.query(
      `SELECT * FROM documents WHERE doc_id = $1`,
      [docId]
    );
    
    return result.rows[0] || null;
  } catch (error) {
    console.error('Error retrieving document:', error);
    throw error;
  }
}

// Get all documents for a user
export async function getUserDocuments(userId: string) {
  const db = getDb();
  
  try {
    const result = await db.query(
      `SELECT * FROM documents WHERE user_id = $1 ORDER BY created_at DESC`,
      [userId]
    );
    
    return result.rows;
  } catch (error) {
    console.error('Error retrieving user documents:', error);
    throw error;
  }
} 