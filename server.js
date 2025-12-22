// --- Archivo: server.js (CALCULADORA PONDERADO + RANKING) ---
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

// 1. GUARDAR NOTAS Y CALCULAR PONDERADO
app.post('/api/calcular', async (req, res) => {
    const { nombre, n1, n2, n3, n4, n5, n6, n7 } = req.body;

    // Convertimos a números (por seguridad)
    const integral = parseFloat(n1) || 0;
    const lineal = parseFloat(n2) || 0;
    const algoritmia = parseFloat(n3) || 0;
    const etica = parseFloat(n4) || 0;
    const tcs = parseFloat(n5) || 0;
    const psico = parseFloat(n6) || 0;
    const biologia = parseFloat(n7) || 0;

    // FÓRMULA SEGÚN TU EXCEL
    // Suma de (Nota * Peso)
    const sumaPuntos = (integral * 5) + (lineal * 4) + (algoritmia * 3) + (etica * 2) + (tcs * 3) + (psico * 3) + (biologia * 2);
    const totalCreditos = 22; // 5+4+3+2+3+3+2
    
    const promedioFinal = (sumaPuntos / totalCreditos).toFixed(2); // Redondeado a 2 decimales

    try {
        // Guardamos en la base de datos
        const { error } = await supabase
            .from('ranking')
            .insert({
                nombre: nombre,
                nota_integral: integral,
                nota_lineal: lineal,
                nota_algoritmia: algoritmia,
                nota_etica: etica,
                nota_tcs: tcs,
                nota_psico: psico,
                nota_biologia: biologia,
                ponderado: parseFloat(promedioFinal)
            });

        if (error) throw error;
        
        res.json({ mensaje: '¡Cálculo Exitoso!', ponderado: promedioFinal });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: 'Error al guardar datos' });
    }
});

// 2. OBTENER EL RANKING (TOP 50)
app.get('/api/ranking', async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('ranking')
            .select('nombre, ponderado')
            .order('ponderado', { ascending: false }) // De mayor a menor
            .limit(50);

        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Servir la página
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => console.log(`🚀 Calculadora lista en puerto ${PORT}`));
