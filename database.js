// --- Archivo: database.js (VERSIÓN SUPABASE CORRECTA) ---
const { createClient } = require('@supabase/supabase-js');

// Carga las variables de entorno que pusiste en Render
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

let supabase;

// Verifica si las llaves existen
if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Error: Faltan las variables de entorno SUPABASE_URL o SUPABASE_KEY.');
    console.log('Asegúrate de añadirlas en el panel de "Environment" de Render.');
} else {
    // Crea y exporta el cliente de Supabase
    // Esto es nuestro nuevo 'db'
    supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
    console.log('✅ Conexión con Supabase lista.');
}

// ¡ASEGÚRATE DE EXPORTAR 'supabase', NO LA LIBRERÍA!
module.exports = supabase;
