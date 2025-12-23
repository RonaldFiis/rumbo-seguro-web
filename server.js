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

// --- CONFIGURACIÓN DE PESOS POR CARRERA ---
const MALLA_CURRICULAR = {
    sistemas: {
        nota_integral: 5,
        nota_lineal: 4,
        nota_algoritmia: 3,
        nota_etica: 2,
        nota_tcs: 3,
        nota_psico: 3,
        nota_biologia: 2
    },
    industrial: {
        nota_integral: 5,
        nota_lineal: 4,
        nota_intro_compu: 2,
        nota_tgs_industrial: 2,
        nota_desarrollo: 2,
        nota_realidad: 3,
        nota_quimica2: 4
    },
    software: {
        nota_integral: 5,
        nota_lineal: 4,
        nota_algoritmia: 3,
        nota_dibujo: 3,
        nota_discreta: 3,
        nota_fisica1: 5
    }
};

// 1. CALCULAR Y GUARDAR NOTAS
app.post('/api/calcular', async (req, res) => {
    try {
        const { nombre, carrera, notas } = req.body; 

        if (!MALLA_CURRICULAR[carrera]) {
            return res.status(400).json({ error: 'Carrera no válida' });
        }

        const planEstudios = MALLA_CURRICULAR[carrera];
        let sumaProducto = 0;
        let creditosTotales = 0;

        // Iterar sobre los cursos de esa carrera
        for (const [columna, peso] of Object.entries(planEstudios)) {
            const valorNota = parseFloat(notas[columna]);

            // Si la nota es válida y NO es -1 (retiro)
            if (!isNaN(valorNota) && valorNota !== -1) {
                sumaProducto += (valorNota * peso);
                creditosTotales += peso;
            }
        }

        const promedio = creditosTotales === 0 ? 0 : (sumaProducto / creditosTotales).toFixed(4);

        // Preparar objeto para guardar en BD
        const datosParaGuardar = {
            nombre,
            carrera,
            ponderado: parseFloat(promedio),
            ...notas // Guardamos las notas individuales
        };

        const { error } = await supabase.from('ranking').insert(datosParaGuardar);

        if (error) throw error;

        res.json({ success: true, ponderado: promedio, creditos: creditosTotales, carrera });

    } catch (e) {
        console.error("Error:", e.message);
        res.status(500).json({ error: 'Error interno' });
    }
});

// 2. OBTENER RANKING (POR CARRERA O GENERAL)
app.get('/api/ranking/:carrera', async (req, res) => {
    const { carrera } = req.params;
    
    try {
        // Iniciamos la consulta base
        let query = supabase
            .from('ranking')
            .select('nombre, ponderado, carrera') // Importante: Traemos la carrera para mostrarla en la tabla
            .order('ponderado', { ascending: false })
            .limit(50);
        
        // Solo filtramos SI NO es "general"
        if (carrera !== 'general') {
            query = query.eq('carrera', carrera);
        }
        
        const { data, error } = await query;
        
        if (error) throw error;
        res.json(data);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// Servir frontend
app.get('/', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => console.log(`🚀 Servidor FIIS con Ranking General listo en puerto ${PORT}`));
