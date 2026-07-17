# Recopilatorio de decisiones - The Fresh Connection

## Nota de alcance

Este archivo es una **reconstruccion cronologica** de las decisiones tomadas durante la conversacion, usando los mensajes del simulador, las capturas enviadas y los ajustes que fuimos aprobando por rol. No es un export automatico del `decision log` del juego.

Por eso, debe leerse asi:

- Las rondas 0 y 1 resumen la etapa de prueba/error y aprendizaje.
- Desde la ronda 2 estan las decisiones que marcaron la recuperacion real del ROI.
- Las decisiones por rol estan ordenadas segun el momento en que las fuimos trabajando: Sales, Purchasing, Operations y Supply Chain.
- Cuando una accion aparece como "recomendada", significa que fue la decision que acordamos aplicar o validar en pantalla, salvo que el juego no permitiera ese valor exacto.
- Si se necesita precision absoluta, habria que contrastar este resumen con el `decision log` interno del simulador.

Este documento resume las decisiones tomadas desde la ronda 0 hasta la ultima ronda trabajada. La lectura correcta de la evolucion es que **las rondas 0 y 1 fueron principalmente de prueba, error y aprendizaje**. La mejora real empezo desde la **ronda 2**, cuando dejamos de perseguir indices de contrato "bonitos" y empezamos a coordinar Sales, Purchasing, Operations y Supply Chain como una sola cadena.

## Estrategia general

La estrategia que se fue construyendo fue:

**Primero recuperar confiabilidad y servicio real; despues optimizar costos, inventario y capacidad.**

Al inicio el problema principal no era un solo rol, sino la falta de alineacion:

- Sales prometia niveles de servicio y condiciones dificiles de cumplir.
- Purchasing intentaba cuidar el contract index, pero algunos componentes criticos quedaban con riesgo de disponibilidad, calidad o lead time.
- Operations estaba saturado y con baja adherencia al plan.
- Supply Chain habia bajado inventarios en algunos puntos donde todavia habia mucha incertidumbre.

El criterio que se empezo a usar bien desde la ronda 2 fue: no perseguir contract index cercano a 1 por si mismo, sino maximizar utilidad total considerando servicio, penalizaciones, obsoletos, inventario, produccion y confiabilidad.

La curva de ROI confirma esta historia:

| Ronda | Lectura |
|---|---|
| 0 | ROI negativo; decisiones iniciales poco alineadas |
| 1 | Peor resultado; todavia estabamos corrigiendo sin una estrategia clara |
| 2 | Punto de quiebre; empieza la recuperacion |
| 3-5 | Optimización progresiva; ROI positivo y creciente |
| 6 | Ligera caida, pero todavia en zona rentable |

---

## Ronda 0 - Situacion inicial

### Diagnostico

En la ronda 0 las decisiones fueron bastante exploratorias. Se intento acercar los contract index a 1, pero sin una estrategia clara entre areas.

### Problemas detectados

- ROI negativo o muy debil.
- Servicio real por debajo de lo prometido.
- Penalizaciones altas por incumplimiento.
- Obsoletos inicialmente altos, luego bajados con recortes demasiado agresivos.
- Produccion con utilizacion excesiva y baja adherencia al plan.
- Componentes criticos con baja disponibilidad.
- Diferencias de shelf life entre clientes, creando complejidad.

### Aprendizaje

El contract index no es el objetivo final:

- En Sales, un indice alto puede mejorar ingresos, pero tambien implica promesas mas exigentes.
- En Purchasing, un indice bajo puede ahorrar, pero puede traer mala calidad, baja confiabilidad o mayor riesgo.
- La utilidad mejora cuando lo prometido por Sales coincide con lo que Purchasing, Operations y Supply Chain pueden sostener.

---

## Ronda 1 - Correccion inicial, pero todavia con mal resultado

### Lectura general

Aunque en esta ronda se intentaron varias correcciones, el resultado todavia no fue bueno. Segun la curva de ROI, la ronda 1 fue el punto mas bajo. Por eso no conviene presentar esta ronda como una "buena decision" todavia, sino como el momento donde se aprendio que los cambios aislados no bastaban.

### Sales

Cambios intentados:

- Bajar los service levels prometidos a una zona mas cumplible, alrededor de 90% a 92%.
- Estandarizar shelf life cerca de 75%.
- Mantener payment term en 4 semanas.
- Usar shortage rule por prioridad, no first come first served.
- Prioridad de clientes:
  1. Food & Groceries
  2. LAND Market
  3. Dominick's
- Reducir complejidad en Dominick's, dejando primero productos mas estables.

Motivo / aprendizaje:

Sales estaba prometiendo mas de lo que la cadena podia cumplir. La idea de bajar promesas era correcta, pero todavia faltaba coordinarla mejor con inventario, proveedores y produccion.

### Purchasing

Cambios intentados:

| Componente | Decision |
|---|---|
| Pack | Smurfat Kippa Cartons, calidad alta, truck, reliability aprox. 95%, delivery window 1 day |
| PET | Philyp Jones Plastics, calidad alta, truck, reliability moderada |
| Orange | Arancia d'Espana, proveedor rapido y confiable |
| Mango | NO8DO Mango, corregido a delivery window 1 day |
| Vitamin C | SYI / Netherlands, reliability alta y delivery window corto |

Motivo / aprendizaje:

Se empezo a entender que Pack, Orange y Vitamin C eran criticos para sostener servicio. Sin embargo, todavia habia que ajustar mejor calidad, confiabilidad y costos para que la decision se tradujera en ROI.

### Operations

Cambios intentados:

- Activar o mantener SMED.
- Activar entrenamiento para resolver averias.
- Usar mantenimiento preventivo basico.
- Aumentar capacidad operativa si la utilizacion estaba sobre 100%.
- Subir capacidad inbound y FTE.
- Reducir intake time a 2 dias.
- Reducir un poco outbound si estaba subutilizado.

Motivo / aprendizaje:

La produccion estaba saturada. La direccion era correcta: mejorar adherence, reducir overtime y estabilizar el plan. Pero el resultado de ROI muestra que aun no estaba balanceado con costos e inventario.

### Supply Chain

Cambios intentados:

- Subir safety stock de Pack y Orange.
- Subir Vitamin C inicialmente para proteger disponibilidad.
- Bajar PET porque estaba sobrado.
- Mantener Mango bajo/moderado porque su disponibilidad estaba bien.
- Subir frozen period a 4 semanas.
- Ajustar finished goods con mas stock en productos criticos, pero sin volver a obsoletos altos.

Motivo / aprendizaje:

Habia que recuperar disponibilidad y servicio. El aprendizaje clave fue que no bastaba con subir o bajar stock: habia que diferenciar por criticidad, vida util, proveedor y demanda.

---

## Ronda 2 - Punto de quiebre: empiezan las buenas decisiones

### Resultado observado

- El servicio subio fuerte, cerca de 96% a 97%.
- Se paso de penalizaciones altas a bonus.
- La obsolescencia empezo a subir otra vez, alrededor de 2.8%.
- Produccion mejoro mucho su adherencia, pero quedo con capacidad ociosa.
- El ROI paso a positivo. Esta fue la primera ronda donde la estrategia empezo a funcionar de verdad.

### Sales

Decisiones:

- Mantener service levels alrededor de 90% inicialmente.
- Mantener shelf life mas estandarizado.
- Mantener payment term en 4.
- Mantener priority en shortage rules.
- Revisar category management para reducir complejidad.
- Dominick's se simplifico, dejando principalmente PET y evitando 1L especiales.

Motivo:

El servicio ya estaba recuperado, pero no convenia subir promesas demasiado rapido. Habia que evitar que regresaran penalizaciones u obsoletos.

### Purchasing

Decisiones:

- Mantener Smurfat para Pack.
- Mantener Philyp para PET.
- Mantener Arancia para Orange.
- Mantener NO8DO para Mango, pero con contrato corregido.
- Mantener SYI para Vitamin C.
- No usar dual source de forma general.

Motivo:

La red de proveedores ya estaba mas estable. Se decidio no pagar costos extra salvo donde el riesgo fuera claro.

### Operations

Decisiones:

- Mantener entrenamiento, mantenimiento y SMED.
- Ajustar capacidad de warehouse:
  - Inbound mejorado.
  - Outbound reducido si estaba subutilizado.
- Revisar production intervals con la herramienta.
- Si subir intervalos aumentaba costo total, volver al intervalo anterior.

Motivo:

Ya no se trataba solo de agregar capacidad. Habia que encontrar el menor costo sin romper adherence.

### Supply Chain

Decisiones:

- Reducir safety stock donde la disponibilidad estaba demasiado alta.
- Subir Mango ligeramente si caia bajo 99%.
- Bajar Vitamin C si quedaba con exceso.
- Mantener frozen period en 4 semanas.

Motivo:

Se paso de "proteger servicio" a "reducir exceso de inventario".

---

## Ronda 3 - Forecast, calidad y alineacion

### Resultado observado

- ROI ya estaba positivo, alrededor de 6% a 7%.
- Forecast bias se volvio un tema importante.
- Algunos productos 1L especiales quedaron subforecasted por haber ajustado demasiado el forecast.
- Se detectaron rechazos altos en algunos proveedores.

### Sales

Decisiones:

- Corregir forecast de C-power 1L y Mango 1L de -10% a 0%.
- Mantener forecast de los demas productos en 0%.
- No cambiar agreements grandes si no habia mensajes nuevos.
- Mantener priority.
- Mantener category management simplificado.

Motivo:

El bias negativo significaba que se vendia mas de lo pronosticado. Supply Chain compraba y producia menos de lo necesario. La correccion fue devolver esos forecast a 0%.

### Purchasing

Decisiones:

- Subir reliability contratada de PET con Philyp hasta 94%.
- Mantener Pack en 95%.
- Subir o confirmar calidad alta para Mango y Vitamin C si los rechazos seguian altos.
- Eliminar dual source de Mango si no habia stockout grave.
- No usar supplier development todavia.

Motivo:

PET tenia reliability real baja. Mango y Vitamin C tenian problemas de rechazo. Pero el dual source era caro para el volumen de Mango.

### Operations

Decisiones:

- Mantener 2 shifts si la capacidad estaba sana.
- Mantener maintenance, training y SMED.
- No aumentar velocidad.
- Ajustar inbound/outbound con cuidado.

Motivo:

Production plan adherence estaba mucho mejor. El riesgo era sobrecorregir y volver a costos innecesarios.

### Supply Chain

Decisiones:

- Bajar inventario de componentes con 100% availability.
- Mantener PET/Mango con cuidado porque estaban mas justos.
- Reducir safety stock de productos terminados hacia 2.0 semanas.
- Vigilar especialmente C-power PET por obsoletes.

Motivo:

La disponibilidad estaba alta, pero el costo de inventario y obsoletos empezaba a pesar.

---

## Ronda 4 - Preforms, VMI y optimizacion estructural

### Resultado observado

- ROI subio, alrededor de 8%.
- Raw material costs bajaron fuertemente.
- PET preforms aparecio como oportunidad clara.
- VMI se volvio disponible con proveedores.

### Sales

Decisiones:

- Mantener forecast en 0% porque el bias ya estaba bien.
- Mantener category management:
  - Food & Groceries con todos los productos.
  - LAND Market con todos los productos.
  - Dominick's principalmente PET.
- Mantener priority.
- Evaluar VMI con clientes, especialmente LAND Market.
- Mantener promociones ligeras, no subir a medio o heavy.

Motivo:

Forecast ya estaba funcionando. La mejora venia por reducir volatilidad y mejorar visibilidad, no por forzar ventas.

### Purchasing

Decisiones:

- Mantener PET reliability en 94%, no subir a 95%.
- Activar PET preforms junto con Operations.
- Mantener VMI en PET y Orange.
- No usar supplier development todavia.
- No reactivar dual source Mango.

Motivo:

Preforms reducia costo y espacio de PET de forma enorme. Era mejor usar herramientas estructurales que seguir pagando reliability adicional.

### Operations

Decisiones:

- Instalar modulo PET preforms en Swiss Fill 2.
- Mantener 2 shifts.
- Mantener maintenance, training y SMED.
- No activar outsourcing ni MCC.
- Si preforms se activaba, bajar raw materials warehouse capacity.

Motivo:

La linea estaba estable. Preforms reducia presion en inbound y transporte. Outsourcing/MCC metian complejidad innecesaria.

### Supply Chain

Decisiones:

- Si PET y Orange estaban bajo VMI, dejar de gestionarlos manualmente desde SCM.
- Bajar Pack, Mango y Vitamin C si tenian exceso.
- Mantener finished goods cerca de 2.0 semanas.
- C-power PET podia bajar a 1.5 si obsoletes eran altos.
- Mantener frozen period en 4 semanas.

Motivo:

VMI cambiaba las reglas: algunos inventarios ya los gestionaba el proveedor. SCM debia enfocarse en productos terminados y componentes no VMI.

---

## Ronda 5 - Ultima ronda trabajada

### Resultado observado

- ROI alrededor de 8.4%.
- Raw material costs bajaron a cerca de 25.6%.
- Delivery reliability suppliers subio a aprox. 94.3%.
- Rejection components bajo a aprox. 2.3%.
- PET preforms funciono: el precio y transporte de PET bajaron fuerte.
- Inbound raw materials warehouse quedo muy sobrado, con utilizacion cercana a 29%.
- Produccion quedo muy bien, con adherence alrededor de 97%.
- Obsoletos seguian cerca de 2%, todavia a vigilar.

### Sales

Decisiones recomendadas:

| Cliente | Service | Shelf life | Deadline | Unit | Payment | Promo pressure | Promo horizon | VMI |
|---|---:|---:|---|---|---:|---|---|---|
| Food & Groceries | 92.0 | 70.0 | 14:00 | Pallet | 4 | Poco | Largo | Si |
| LAND Market | 91.5 | 70.5 | 14:00 | Pallet | 4 | Poco | Largo | Si |
| Dominick's | 91.5 | 70.0 | 12:00 | Pallet layer | 4 | Ninguna | Corto | No |

Tambien:

- Mantener forecast en 0% para todos.
- Mantener category management actual.
- Mantener priority:
  1. Food & Groceries
  2. LAND Market
  3. Dominick's

Motivo:

Se queria mejorar visibilidad y estabilidad con VMI y horizonte largo, pero sin subir promocion a medio porque eso genera volatilidad, obsoletos y overtime.

### Purchasing

Decisiones recomendadas:

| Tema | Decision |
|---|---|
| PET preforms | Mantener |
| VMI PET | Mantener |
| VMI Orange | Mantener |
| Philyp reliability | Mantener en 94%, no subir mas |
| Supplier development | No usar todavia |
| Dual source Mango | No reactivar |
| Pack / Orange / Mango / Vitamin C | No tocar salvo alerta fuerte |

Motivo:

Purchasing ya estaba aportando mucho valor: raw material costs bajaron, reliability subio y rechazos bajaron. Subir mas reliability podia encarecer sin resolver proporcionalmente.

### Operations

Decisiones recomendadas:

| Area | Decision |
|---|---|
| Raw materials warehouse capacity | bajar de 650 a 500 aprox. |
| Raw materials FTE | bajar a 3 si el sistema permite |
| Intake time | mantener 2 dias |
| Finished goods warehouse capacity | mantener 1200 |
| Finished goods FTE | mantener |
| Shifts | mantener 2 |
| Maintenance / training / SMED | mantener |
| Increase speed | No |
| Outsourcing / MCC | No activar todavia |

Motivo:

PET preforms redujo drasticamente el espacio inbound necesario. La produccion estaba muy sana, asi que no habia que tocar la linea; solo recortar capacidad ociosa en materia prima.

### Supply Chain

Decisiones recomendadas:

Componentes:

| Componente | Decision |
|---|---|
| PET | gestionado por VMI |
| Orange | gestionado por VMI |
| Pack | bajar safety stock a 1.5 o 2.0 |
| Mango | bajar o mantener en 1.5-2.0 |
| Vitamin C | bajar a 1.5 o 2.0 |

Productos terminados:

| Producto | Safety stock recomendado |
|---|---:|
| Fressie Naranja 1L | 2.0 |
| Fressie Naranja/C-Power 1L | 2.0 |
| Fressie Naranja/Mango 1L | 2.0 |
| Fressie Naranja PET | 2.0 |
| Fressie Naranja/C-Power PET | 1.5 o 2.0 |
| Fressie Naranja/Mango PET | 2.0 |

Tambien:

- Mantener frozen period en 4 weeks.
- Mantener production intervals donde el tool de menor costo, probablemente cerca de 7 / 6 / 6 / 5 / 5 / 5.

Motivo:

La disponibilidad estaba altisima. El objetivo era bajar inventario y obsoletos sin romper el servicio.

---

## Resumen final por rol

### Sales

En rondas 0-1, Sales todavia estaba desalineado con la capacidad real de la cadena. Desde ronda 2, paso a prometer de forma mas cumplible, mejorar forecast y luego usar VMI/horizonte promocional para dar estabilidad sin inflar promociones.

### Purchasing

En rondas 0-1 se noto el error de perseguir contract index sin ver el impacto total. Desde ronda 2, Purchasing empezo a asegurar proveedores criticos. Luego optimizo con PET preforms y VMI, evitando pagar mas reliability o supplier development sin necesidad.

### Operations

En rondas 0-1 Operations todavia estaba entre saturacion y correcciones costosas. Desde ronda 2, paso a estabilizar produccion con maintenance, training, SMED y capacidad adecuada. Luego, cuando preforms redujo inbound, el foco fue bajar capacidad ociosa.

### Supply Chain

En rondas 0-1 Supply Chain todavia estaba aprendiendo donde faltaba stock y donde sobraba. Desde ronda 2, paso de apagar incendios de disponibilidad a gestionar inventario diferenciado. Luego redujo excesos, adopto VMI para componentes grandes y mantuvo stock terminado controlado para evitar obsoletos.

## Conclusion

Si alguien pregunta que estrategia siguio el equipo, la respuesta seria:

**Las rondas 0 y 1 fueron aprendizaje. Desde la ronda 2 estabilizamos la cadena para recuperar servicio y ROI; despues optimizamos costos reduciendo inventario, capacidad ociosa y complejidad, sin volver a romper la confiabilidad.**
