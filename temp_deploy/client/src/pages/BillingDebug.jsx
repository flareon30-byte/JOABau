
import React from 'react';

const BillingDebug = () => {
    return (
        <div className="p-10 bg-red-50 border-4 border-red-500 rounded-xl">
            <h1 className="text-4xl font-bold text-red-600 mb-4">¡PRUEBA DE SISTEMA EXITOSA!</h1>
            <p className="text-xl text-slate-700">
                Si estás leyendo esto, significa que tu servidor <strong>SÍ</strong> está recibiendo las actualizaciones.
            </p>
            <div className="mt-6 p-4 bg-white rounded shadow">
                <p>Versión del código: <strong>v3.0 (Emergency Fix)</strong></p>
                <p>Fecha: {new Date().toLocaleString()}</p>
            </div>
        </div>
    );
};

export default BillingDebug;
