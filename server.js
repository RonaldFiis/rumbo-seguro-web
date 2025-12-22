// --- Archivo: server.js (VERSIÓN CON RETIRO DE CURSOS) ---
const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Conexión a Supabase
const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY);

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CONFIGURACIÓN DE PESOS (CRÉDITOS)
const PESOS = {
    n1: 5, // Integral
    n2: 4, // Lineal
    n3: 3, // Algoritmia
    n4: 2, // Ética
    n5: 3, // TCS
    n6: 3, // Psico
    n7: 2  // Biología
};

// 1. CALCULAR Y GUARDAR (CON LÓGICA DE RETIRO)
app.post('/api/calcular', async (req, res) => {
    try {
        const { nombre, n1, n2, n3, n4, n5, n6, n7 } = req.body;
        
        // Recibimos las notas. Si es -1, significa RETIRADO.
        const notas = { n1, n2, n3, n4, n5, n6, n7 };
        
        let sumaProducto = 0;
        let creditosTotales = 0;

        // Iteramos cada curso para calcular dinámicamente
        for (const [key, val] of Object.entries(notas)) {
            const nota = parseFloat(val);
            
            // Si la nota es -1, el curso se ignora (Retirado)
            if (nota !== -1) {
                const peso = PESOS[key];
                sumaProducto += (nota * peso);
                creditosTotales += peso;
            }
        }

        // Evitar división por cero si retiró todo
        const promedioPonderado = creditosTotales === 0 ? 0 : (sumaProducto / creditosTotales).toFixed(4);

        // Guardar en Supabase (Guardamos -1 para saber que retiró)
        const { error } = await supabase
            .from('ranking')
            .insert({
                nombre: nombre,
                nota_integral: parseFloat(n1),
                nota_lineal: parseFloat(n2),
                nota_algoritmia: parseFloat(n3),
                nota_etica: parseFloat(n4),
                nota_tcs: parseFloat(n5),
                nota_psico: parseFloat(n6),
                nota_biologia: parseFloat(n7),
                ponderado: parseFloat(promedioPonderado)
            });

        if (error) throw error;

        res.json({ success: true, ponderado: promedioPonderado, creditos: creditosTotales });

    } catch (e) {
        console.error("Error:", e.message);
        res.status(500).json({ error: 'Error al procesar notas' });
    }
});

// 2. OBTENER RANKING (TOP 100)
app.get('/api/ranking', async (req, res) => {
    const { data, error } = await supabase
        .from('ranking')
        .select('nombre, ponderado')
        .order('ponderado', { ascending: false })
        .limit(100);
    
    if (error) return res.status(500).json({ error: error.message });
    res.json(data);
});

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Calculadora (Con Retiros) lista en puerto ${PORT}`));
