# Mensajes e impacto en decisiones - The Fresh Connection

## Alcance

Este documento recopila los mensajes del simulador que se usaron para tomar decisiones desde la etapa en que la estrategia empezo a funcionar, es decir, **desde la ronda 2 en adelante**. Se excluyen las rondas 0 y 1 porque fueron principalmente de exploracion y aprendizaje.

No es una transcripcion automatica del juego. Es una reconstruccion ejecutiva a partir de los mensajes enviados en la conversacion, organizada por area e integrante. Para cada mensaje se indica:

- que problema o informacion trajo;
- como influyo en la decision;
- que accion concreta se tomo o se recomendo.

## Lectura general de la evolucion

La curva de ROI muestra que la recuperacion real empieza en la ronda 2. Antes de eso se intentaba acercar indices de contrato a 1 o corregir areas aisladas. Desde la ronda 2 se tomo una direccion mas coherente:

**cumplir servicio real primero, luego optimizar costos, inventario, capacidad y complejidad.**

---

# 1. Mensajes de Sales

## George de Jong - Customer Service Manager

### Mensaje: mejora fuerte del servicio, pero aumento de obsoletos

Contenido recibido:

- El servicio por cliente subio de niveles cercanos a 81%-84% hacia 96%-97%.
- Las penalizaciones se convirtieron en bonus.
- El equipo habia bajado promesas de servicio a 90% y shelf life a 75%.
- La obsolescencia subio, por ejemplo de 1.1% a 2.8%.
- George pidio balancear servicio y obsoletos.

Impacto en decisiones:

- Confirmo que bajar promesas de Sales habia funcionado para recuperar servicio.
- Evito que subieramos agresivamente los service levels de inmediato.
- Nos llevo a mantener shelf life mas estandarizado para reducir complejidad.
- Se decidio que Sales no debia volver a prometer demasiado hasta que Operations y Supply Chain estuvieran estables.

Decisiones tomadas:

- Mantener service level en zona controlada, alrededor de 90%-92%.
- Mantener shelf life cercano a 75% al inicio, luego ajustarlo en rondas posteriores.
- Mantener payment term en 4 semanas.
- Usar shortage rule por prioridad.

### Mensaje: forecast con bias negativo en C-power 1L y Mango 1L

Contenido recibido:

- George aviso que habia bias de -8% en Fressie Orange/C-power 1L y Fressie Orange/Mango 1L.
- El mensaje explicaba que el forecast estaba por debajo de la venta real.
- Supply Chain se veia afectado porque el forecast guia compras, stock y produccion.
- El mensaje remarco que el forecast debe predecir ventas, no manipularlas.

Impacto en decisiones:

- Nos dimos cuenta de que bajar el forecast a -10% habia sido demasiado agresivo.
- El surtido de Dominick's habia sido reducido, pero Food & Groceries y LAND seguian vendiendo esos productos.
- Habia que corregir forecast sin cambiar todo Sales.

Decisiones tomadas:

- Volver C-power 1L de -10% a 0%.
- Volver Mango 1L de -10% a 0%.
- Mantener los demas forecast en 0%.
- No cambiar contratos, category management ni promociones en esa ronda.

### Mensaje: forecast ya estaba preciso, pero otros roles pedian revisar contratos

Contenido recibido:

- George indico que el forecast tenia sesgo minimo.
- Supply Chain estaba satisfecho con la precision.
- Pero SCM, Operations y Purchasing pedian revisar contratos con clientes para mejorar eficiencia y confiabilidad.
- Sales queria equilibrar ingresos con presion interna.

Impacto en decisiones:

- Se confirmo que el forecast ya no era el problema.
- El foco paso a mejorar estabilidad operativa con contratos menos volatiles.
- Se considero usar VMI con clientes y alargar el horizonte promocional.

Decisiones tomadas:

- Mantener forecast en 0%.
- Mantener category management simplificado.
- Activar VMI con Food & Groceries y luego LAND Market.
- Usar horizonte promocional largo.
- Mantener presion promocional baja, no media ni alta.

## Bob McLaren - CEO

### Mensaje: ROI positivo, pero falta de alineacion

Contenido recibido:

- Bob aviso que el ROI habia mejorado y estaba positivo.
- Aun asi, senalo que no habia una historia estrategica clara.
- Las decisiones de shelf life, frozen period, production intervals y promesas comerciales parecian mezcladas.

Impacto en decisiones:

- Nos obligo a dejar de optimizar cada rol por separado.
- La estrategia se definio como servicio confiable y despues eficiencia.
- Se empezo a rechazar el "indice de contrato bonito" como objetivo principal.

Decisiones tomadas:

- Mantener promesas alcanzables en Sales.
- Alinear Purchasing con componentes criticos.
- Alinear Operations con capacidad real.
- Alinear Supply Chain con inventario diferenciado.

### Mensaje: ROI 7%-8%, bonos altos, obsoletos cerca de 2%

Contenido recibido:

- Bob felicito por el ROI, que subio hacia 7%-8%.
- Tambien senalo que los bonus altos indicaban posible desconexion entre promesas y capacidad real.
- Obsoletos cerca de 2% mostraban desalineacion en frescura.
- Inbound warehouse habia caido a 29% de utilizacion mientras produccion seguia con overtime.

Impacto en decisiones:

- Se decidio no seguir inflando promociones o promesas para perseguir ingresos.
- Se decidio recortar capacidad ociosa en inbound tras PET preforms.
- Se mantuvo la produccion estable sin tocar turnos.

Decisiones tomadas:

- Sales: promo pressure en Poco, no Medio.
- Operations: bajar capacidad de raw materials warehouse.
- Supply Chain: bajar stocks donde habia disponibilidad excesiva.
- Purchasing: mantener preforms y VMI, no pagar mas reliability.

---

# 2. Mensajes de Purchasing

## Julia Johnson - Supplier Performance Manager

### Mensaje: rechazos altos de proveedores

Contenido recibido:

- NO8DO Mango llego a 5.3% de rechazo.
- SYI Vitamin C llego a 4.7% de rechazo.
- Philyp Jones Plastics tenia 3.0% de rechazo.
- Smurfat Kippa Cartons tenia 2.2% de rechazo.
- Julia advirtio que los rechazos generaban reordenes, riesgo de stockout y problemas en linea.

Impacto en decisiones:

- Cambiamos el foco de "indice bajo" a calidad y confiabilidad.
- Mango y Vitamin C pasaron a ser candidatos para calidad alta.
- Se evito bajar calidad solo para mejorar contract index.

Decisiones tomadas:

- Mantener Smurfat en High.
- Mantener Philyp en High.
- Subir o confirmar NO8DO Mango en High si era necesario.
- Subir o confirmar SYI en High si era necesario.
- No usar proveedor barato si aumentaba rechazos.

### Mensaje: mejora de reliability de Philyp Jones Plastics

Contenido recibido:

- Se aumento la reliability contratada de Philyp para PET de 91.5% a 93.0%.
- Luego se aumento de 93.0% a 94.0%.
- Julia comento que Supply Chain valoraba el cambio porque podia mejorar disponibilidad y bajar inventario.
- Tambien reconocio el costo adicional.

Impacto en decisiones:

- Se acepto subir PET a 94% porque el desempeno real de Philyp estaba por debajo de lo esperado.
- Pero se decidio no seguir subiendo a 95% para evitar pagar de mas.

Decisiones tomadas:

- PET / Philyp Jones: reliability contratada en 94%.
- No subir mas reliability despues de 94%.
- Atacar el problema de PET con preforms y VMI, no solo con mas precio.

### Mensaje: VMI con Philyp/PET y Arancia/Orange

Contenido recibido:

- Julia aviso que se implemento VMI con Philyp para PET.
- El proveedor pasaba a gestionar inventario dentro de limites acordados.
- Tambien se implemento VMI con Arancia para Orange.
- Julia dudaba si se habia coordinado adecuadamente con Supply Chain.

Impacto en decisiones:

- Se marco que Supply Chain ya no debia gestionar manualmente PET y Orange si estaban en VMI.
- Se decidio mantener VMI porque PET y Orange tenian volumen suficiente.
- Se evito aplicar VMI a todos los componentes.

Decisiones tomadas:

- Mantener VMI en PET.
- Mantener VMI en Orange.
- No activar VMI en Pack, Mango ni Vitamin C por ahora.
- Coordinar VMI con Supply Chain.

## Game host - Modulos de Purchasing

### Mensaje: dual sourcing para pulpas

Contenido recibido:

- Se habilito dual source para componentes de pulpa.
- Tenia costo anual de 40,000 euros por proveedor.
- La orden del dual source seria de una semana de demanda forecast.

Impacto en decisiones:

- Se considero dual source solo para Mango.
- Luego se descarto porque Mango tenia bajo volumen y el costo era alto.

Decisiones tomadas:

- No activar dual source general.
- Si se hubiera necesitado para Mango, la mejor opcion era Proveedor Nigeria.
- Finalmente eliminar/no reactivar dual source Mango salvo stockout grave.

### Mensaje: PET preforms

Contenido recibido:

- Se habilito modulo para inflar preformas PET en planta.
- Las preformas cuestan la mitad que las botellas PET listas.
- Ocupan una decima parte del espacio.
- Se compran al mismo proveedor de PET.

Impacto en decisiones:

- Fue una de las decisiones estructurales mas importantes.
- Reducir PET a preforms bajaba costo de compra, transporte y espacio inbound.
- Requeria coordinacion con Operations para instalar modulo.

Decisiones tomadas:

- Purchasing mantiene Philyp, pero compra PET como preforms.
- Operations instala modulo de preforms en Swiss Fill 2.
- Supply Chain recalcula EOQ y stock de PET.

### Mensaje: Supplier Development

Contenido recibido:

- Se habilito programa de desarrollo de proveedores.
- Costo anual de 60,000 euros por proveedor.
- Puede mejorar certificacion, reliability y rechazos.

Impacto en decisiones:

- Se analizo, pero se considero demasiado caro para el momento.
- No habia un proveedor con suficiente urgencia/volumen que justificara 60,000 euros.

Decisiones tomadas:

- No activar supplier development todavia.

---

# 3. Mensajes de Operations

## Shaoxing Li - Production Manager

### Mensaje: adherencia sube, pero capacidad ociosa alta

Contenido recibido:

- Production plan adherence subio de 77% a 94%.
- Overtime se elimino.
- Pero unused capacity subio a 36% y utilization bajo a 64%.
- Shaoxing pregunto si la estrategia era bajo costo o responsiveness.

Impacto en decisiones:

- Confirmo que se habia pasado de saturacion a capacidad excesiva.
- Se dejo de agregar capacidad.
- Se empezo a usar la herramienta de production intervals para buscar menor costo.

Decisiones tomadas:

- Mantener mantenimiento, training y SMED.
- No aumentar turnos si no era necesario.
- Ajustar intervalos solo si el costo total bajaba.
- Si alargar intervalos subia costo, volver al intervalo anterior.

### Mensaje: reduccion de 3 a 2 turnos dejo poca holgura

Contenido recibido:

- Al bajar de 3 a 2 turnos, utilization subio a 93.6%.
- Production plan adherence bajo ligeramente de 94% a 93%.
- Operations advirtio que con capacidad apretada cualquier volatilidad podria generar overtime.

Impacto en decisiones:

- Se decidio no seguir bajando turnos.
- La capacidad quedo ajustada, pero aceptable.
- Se pidio coordinar con Supply Chain sobre frozen period e intervalos.

Decisiones tomadas:

- Mantener 2 shifts.
- No bajar mas capacidad de bottling.
- Mantener training, maintenance y SMED.
- No aumentar velocidad.

### Mensaje: PET preforms y modulo de inflado

Contenido recibido:

- El game host aviso que Operations podia instalar un modulo para inflar preformas PET.
- Esto permitia comprar preformas en vez de botellas listas.

Impacto en decisiones:

- Operations se volvio clave para que Purchasing pudiera cambiar PET a preforms.
- Se decidio instalar el modulo en Swiss Fill 2.

Decisiones tomadas:

- Instalar modulo PET preforms.
- Mantener 2 shifts.
- Mantener maintenance, training y SMED.

## Mireia Hernandez - Warehouse Manager

### Mensaje: inbound mejoro, pero workload era volatil

Contenido recibido:

- Se habia subido inbound a 700 pallet locations y se agrego FTE.
- Overflow bajo de 13.7% a 3.4%.
- Pero las horas diarias variaban mucho, de 4 a 58 horas.
- Outbound tambien tenia volatilidad.

Impacto en decisiones:

- Se evito bajar personal demasiado rapido.
- Se mantuvo cierta capacidad para picos.
- Se coordino Supply Chain para no crear entregas enormes.

Decisiones tomadas:

- Mantener inbound con capacidad suficiente.
- Ajustar intake time cuidadosamente.
- No reducir FTE si habia picos.

### Mensaje: inbound cae a 29% por PET preforms

Contenido recibido:

- Tras PET preforms, la utilizacion del almacen de materias primas cayo a cerca de 29%.
- Esto indicaba sobrecapacidad fuerte.

Impacto en decisiones:

- El beneficio de preforms fue visible.
- Operations ya podia recortar raw materials warehouse sin poner en riesgo servicio.

Decisiones tomadas:

- Bajar raw materials warehouse capacity de 650 a cerca de 500.
- Bajar FTE inbound a 3 si el juego lo permitia.
- Mantener intake time en 2 dias.

### Mensaje: outbound estable

Contenido recibido:

- DC Netherlands tenia utilizacion alrededor de 73%.
- Overflow era minimo, cerca de 0.1%.
- Flexible labor era bajo.

Impacto en decisiones:

- No se activo outsourcing de finished goods.
- No se activo MCC.
- Se mantuvo outbound warehouse estable.

Decisiones tomadas:

- Mantener finished goods warehouse en 1200.
- Mantener FTE outbound.
- No activar outsourcing ni MCC.

---

# 4. Mensajes de Supply Chain

## Henk van der Meer - Material Planner

### Mensaje: disponibilidad de componentes alta, pero Mango bajo objetivo

Contenido recibido:

- Pack, PET, Orange y Vitamin C mejoraron hasta 100% de disponibilidad.
- Esto indicaba exceso de inventario.
- Mango bajo a 98.3%, por debajo del objetivo de 99%.
- Henk pidio politica diferenciada segun lead time, shelf life y uso.

Impacto en decisiones:

- Se confirmo que no todos los componentes debian tener el mismo stock.
- Se subio ligeramente Mango.
- Se bajaron componentes con disponibilidad perfecta.

Decisiones tomadas:

- Bajar Pack si estaba muy alto.
- Mantener o bajar PET si estaba sobrado.
- Mantener Orange en nivel moderado por criticidad.
- Subir Mango a 1.5 semanas si caia bajo objetivo.
- Bajar Vitamin C si habia exceso.

### Mensaje: grandes tamanos de pedido generan problemas al almacen

Contenido recibido:

- Henk aviso que PET y Orange tenian order sizes grandes.
- Esto generaba picos en inbound y presion de espacio.

Impacto en decisiones:

- Se empezo a mirar lot size, no solo safety stock.
- Reforzo la decision de usar PET preforms y VMI.

Decisiones tomadas:

- Mantener lot sizes razonables.
- Usar VMI para PET y Orange.
- Reducir presion de PET con preforms.

### Mensaje: PET preforms cambia inventario y EOQ

Contenido recibido:

- Henk explico que al comprar PET granular/preforms, el volumen baja 10 veces y el precio baja a la mitad.
- Esto afecta valor de inventario y requiere recalcular EOQ.
- Supply Chain mantuvo disponibilidad de PET en 100%.

Impacto en decisiones:

- PET dejo de tratarse como botella voluminosa.
- Supply Chain debia ajustar stock y EOQ de PET.
- Operations pudo bajar capacidad inbound.

Decisiones tomadas:

- PET gestionado por VMI.
- Recalcular niveles de PET.
- No mantener capacidad inbound antigua.

## Jacky Hill - Finished Goods Planner

### Mensaje: servicio alto, pero costos de inventario y obsoletos suben

Contenido recibido:

- Service levels subieron a 96%-98%.
- Hubo bonus.
- Interest costs subieron.
- Obsolete costs casi se triplicaron.
- Obsoletes pasaron de 1.1% a 2.8%.

Impacto en decisiones:

- Se entendio que no podiamos seguir aumentando safety stock.
- Empezo la fase de bajar inventario terminado.

Decisiones tomadas:

- Reducir safety stock de finished goods hacia 2.0 semanas.
- Vigilar especialmente productos con obsoletes altos.
- Mantener servicio alto, pero no sobreproteger con stock.

### Mensaje: forecast bias mejora, pero inventario sube

Contenido recibido:

- El bias bajo de -8% a casi 0%.
- Esto fue positivo, pero aumento inventario en algunos productos.
- C-power PET llego a 3.0 semanas y 4.0% de obsoletes.

Impacto en decisiones:

- El problema ya no era forecast, sino exceso de inventario terminado.
- Se decidio bajar safety stock de C-power PET.

Decisiones tomadas:

- Mantener forecast sin cambios.
- Bajar C-power PET a 1.5 o 2.0 semanas.
- Mantener los demas productos cerca de 2.0 semanas.

### Mensaje: production adherence mejora a 97%-98%

Contenido recibido:

- La adherencia al plan de produccion mejoro significativamente.
- Esto elevo servicio e inventario.
- Costos de inventario bajaron ligeramente y el bonus aumento.

Impacto en decisiones:

- Se confirmo que Operations estaba funcionando muy bien.
- Ya no hacia falta inflar stock por miedo a baja adherencia.

Decisiones tomadas:

- Mantener production settings.
- Bajar stock donde habia exceso.
- No tocar forecast si bias era minimo.

---

# 5. Decisiones finales consolidadas por rol

## Sales

Mensajes que mas influyeron:

- George: servicio recuperado pero obsoletos subiendo.
- George: forecast bias -8% en 1L especiales.
- George: forecast ya preciso, pero otros roles piden contratos mas estables.
- Bob: ROI positivo, pero falta alineacion.

Decisiones consolidadas:

| Tema | Decision |
|---|---|
| Forecast | mantener 0% en todos los productos |
| Shortage rule | Priority |
| Prioridad clientes | Food & Groceries, LAND Market, Dominick's |
| Category management | Dominick's principalmente PET; Food y LAND con portafolio completo |
| VMI clientes | Food y LAND si el indice lo permite |
| Promo pressure | Poco, no Medio ni Alto |
| Promo horizon | Largo para Food y LAND |
| Payment term | 4 semanas |

## Purchasing

Mensajes que mas influyeron:

- Julia: rechazos altos en Mango, Vitamin C, PET y Pack.
- Julia: Philyp mejoro de 93% a 94% reliability.
- Julia: VMI implementado con PET y Orange.
- Game host: PET preforms.
- Game host: supplier development y dual sourcing.

Decisiones consolidadas:

| Tema | Decision |
|---|---|
| PET supplier | Philyp Jones Plastics |
| PET reliability | 94%, no subir mas |
| PET preforms | mantener |
| VMI proveedores | PET y Orange |
| Supplier development | no activar todavia |
| Dual source Mango | no reactivar salvo stockout grave |
| Orange | Arancia d'Espana |
| Pack | Smurfat Kippa Cartons |
| Mango | NO8DO Mango |
| Vitamin C | SYI |

## Operations

Mensajes que mas influyeron:

- Shaoxing: de saturacion a capacidad ociosa.
- Shaoxing: 2 shifts deja capacidad ajustada pero manejable.
- Mireia: inbound volatil.
- Mireia/Bob: inbound cae a 29% tras preforms.
- Game host: preform module, outsourcing y MCC.

Decisiones consolidadas:

| Tema | Decision |
|---|---|
| PET preform module | instalado/mantener en Swiss Fill 2 |
| Shifts | 2 |
| Maintenance | mantener |
| Breakdown training | mantener |
| SMED | mantener |
| Increase speed | No |
| Raw materials warehouse | bajar capacidad a aprox. 500 |
| Raw materials FTE | bajar a 3 si permite |
| Finished goods warehouse | mantener 1200 |
| Outsourcing/MCC | no activar todavia |

## Supply Chain

Mensajes que mas influyeron:

- Henk: disponibilidad alta y exceso de inventario.
- Henk: Mango bajo target.
- Henk: order sizes crean picos en warehouse.
- Henk: PET preforms cambia EOQ.
- Jacky: servicio alto pero obsoletos/costos suben.
- Jacky: bias corregido pero C-power PET obsoleto.

Decisiones consolidadas:

| Tema | Decision |
|---|---|
| PET | gestionado por VMI |
| Orange | gestionado por VMI |
| Pack safety stock | bajar a 1.5-2.0 |
| Mango safety stock | 1.5-2.0 |
| Vitamin C safety stock | 1.5-2.0 |
| Finished goods | cerca de 2.0 semanas |
| C-power PET | 1.5 o 2.0 por obsoletes |
| Frozen period | 4 semanas |
| Production intervals | mantener donde el tool de menor costo |

---

# Conclusion

Los mensajes no llevaron a decisiones aisladas, sino a una secuencia:

1. Sales dejo de prometer de mas y corrigio forecast.
2. Purchasing aseguro proveedores criticos y luego optimizo con preforms/VMI.
3. Operations estabilizo produccion y luego recorto capacidad ociosa.
4. Supply Chain bajo exceso de stock sin romper servicio.

La mejora del ROI desde ronda 2 se explica por esa coordinacion. El aprendizaje principal fue que The Fresh Connection no se gana optimizando un indicador por rol, sino alineando promesas comerciales, confiabilidad de proveedores, capacidad operativa e inventario.

