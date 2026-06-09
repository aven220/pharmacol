-- Almacena descripción comercial por consecutivo CUM (Caja x 10, Frasco x 120 ml, etc.)
ALTER TABLE codigos_cum ADD COLUMN IF NOT EXISTS descripcion_producto VARCHAR(500);
