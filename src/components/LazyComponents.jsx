import { lazy } from 'react';

// Code splitting con React.lazy()
export const LazyAgendaexpress = lazy(() => import('./Agendaexpress'));
export const LazyHojadefechas = lazy(() => import('./Hojadefechas'));
export const LazyHojamañana = lazy(() => import('./Hojamañana'));
export const LazyHojapasadomañana = lazy(() => import('./Hojapasadomañana'));
export const LazyFacturasemitidas = lazy(() => import('./Facturasemitidas'));
export const LazyReprogramacionautomatica = lazy(() => import('./Reprogramacionautomatica'));
export const LazyAgendadeldiausuario = lazy(() => import('./Agendadeldiausuario'));
export const LazyAgendadinamicacontador = lazy(() => import('./Agendadinamicacontador'));