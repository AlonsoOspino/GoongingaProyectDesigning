# Aprender Java construyendo la draft app

## 1. Primero, el mapa del proyecto

Java es el lenguaje. Spring es el framework que organiza objetos, HTTP,
seguridad y transacciones. Spring Boot configura e inicia esos componentes
según nuestras dependencias y configuración. El frontend continúa siendo
Next.js/React: recibe JSON desde este backend.

| En tu backend Node | Aquí en Java |
| --- | --- |
| `package.json` | `pom.xml`: dependencias, Java y compilación. |
| `app.js` que inicia Express | `GoongingaApplication.java`: inicia Spring Boot. |
| `require` / `import` | `import`: permite usar tipos de otros paquetes. |
| Carpeta y módulo | `package`: nombre que organiza e identifica las clases. |
| Ruta Express | Método con `@GetMapping`, `@PostMapping`, etc. |
| Controller | Clase con `@RestController`. |
| Service | Clase con `@Service`, creada e inyectada por Spring. |
| Modelo de Prisma | SQL + clase `@Entity` para las tablas nuevas. |
| Repository / llamadas a Prisma | `JpaRepository` o repositorio SQL con `JdbcTemplate`. |
| Objeto JSON de entrada/salida | `record` DTO con campos tipados. |

La organización también cambia: una fase reúne sus archivos. Por ejemplo,
`draft/bans/` contiene `BanController`, `BanService` y `BanPhase`. No necesitas
buscar las reglas de bans en un controlador con todas las etapas mezcladas.

## 2. Dónde están los modelos

"Modelo" puede significar varias cosas. En este proyecto usamos nombres
distintos para que sepas qué mirar:

| Tipo de modelo | Archivo | Qué representa |
| --- | --- | --- |
| Entidad | `draft/data/DraftSessionEntity.java` | Una fila de `draft_sessions`. |
| Entidad | `draft/data/DraftMapEntity.java` | Un mapa seleccionado con su resultado. |
| Entidad | `draft/data/DraftBanEntity.java` | Un turno de ban, incluso cuando se pasa. |
| Estado de dominio | `draft/domain/DraftState.java` | La partida sobre la que se validan las reglas. |
| Valor de dominio | `draft/domain/HeroChoice.java` | Identificador y rol de un héroe. |
| Enum | `draft/domain/DraftPhase.java` | Las fases válidas del flujo. |
| DTO de entrada | `draft/api/DraftRequests.java` | Datos que puede enviar la pantalla. |
| DTO de salida | `draft/api/DraftView.java` | Datos que devuelve la API. |
| Contexto existente | `draft/context/MatchInfo.java` | Datos de la tabla de partidos de Prisma. |

Una entidad no es la respuesta HTTP. Exponerla directamente haría que cambiar
una columna cambiara la API. `DraftViewMapper` construye el JSON que necesita
la pantalla a partir del estado y sus catálogos.

## 3. Primera clase: la entidad de un draft

Abre `draft/data/DraftSessionEntity.java`. Encontrarás esta forma:

```java
@Entity
@Table(schema = "spring_draft", name = "draft_sessions")
public class DraftSessionEntity {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Enumerated(EnumType.STRING)
    @Column(name = "phase", nullable = false, length = 32)
    private DraftPhase phase;

    protected DraftSessionEntity() {
        // JPA necesita este constructor para leer una fila.
    }

    public Long getId() { return id; }
}
```

- **`class`** define un tipo: qué datos tiene un draft y qué métodos ofrece.
  Un objeto es una instancia concreta de esa clase.
- **`public`** permite usar el tipo o método desde otros paquetes.
- **`private`** restringe el campo a la propia clase. Para leerlo desde fuera,
  usamos métodos como `getId()`.
- **`Long`** es un número entero que también puede ser `null`. Antes de
  insertar la fila todavía no tenemos un identificador.
- **El constructor** tiene el mismo nombre de la clase y no declara tipo de
  retorno. Prepara un objeto nuevo.
- **Un método** declara qué devuelve, su nombre y sus parámetros. `getId()`
  devuelve un `Long`; `void` significa que un método no devuelve un valor.
- **Las anotaciones** empiezan con `@`. Son información que los frameworks
  interpretan. `@Entity` y `@Column` pertenecen a JPA, no son palabras del lenguaje.

El constructor público `DraftSessionEntity(DraftState state, Instant now)`
prepara un draft nuevo. El constructor vacío protegido permite a JPA cargar
uno existente. Los métodos `apply`, `pause` y `resume` actualizan campos de
forma controlada; no hay un setter público para cada columna.

## 4. Tipos que vas a encontrar

```java
int mapNumber = 1;
long matchId = 12L;
boolean draw = false;
String name = "Team A";
Integer heroId = null;
```

`int`, `long` y `boolean` son tipos primitivos: no aceptan `null`.
`Integer`, `Long` y `Boolean` son sus versiones objeto, que sí lo aceptan.
En `BanHero`, un `Integer heroId` nulo tiene un significado del producto:
el equipo consume su turno sin vetar un héroe.

`Instant` es un momento en el tiempo; `Duration` es un intervalo. El reloj
usa ambos para calcular 95 segundos y desplazar el vencimiento al reanudar.

`List<BanSelection>` es una lista de bans. `Set<Long>` es un conjunto de IDs
sin duplicados. Los signos `<...>` indican el tipo de elementos permitido.

`var state = draft.state();` permite que el compilador deduzca el tipo local.
La variable sigue teniendo un tipo fijo; no equivale a un valor dinámico de JS.

Para números primitivos se usa `==`. Para comparar contenido de objetos como
`String`, se usa `.equals(...)`. `Long` frente a `long` se convierte a primitivo;
comparar dos objetos `Long` con `==` puede comparar sus identidades.

## 5. `record` y `enum`

Abre `draft/domain/HeroChoice.java`:

```java
public record HeroChoice(long id, HeroRole role) {
    public HeroChoice {
        if (id <= 0 || role == null) {
            throw new IllegalArgumentException("Hero id and role are required.");
        }
    }
}
```

Un `record` declara un dato con campos finales. Java genera constructor,
accesores `id()` y `role()`, comparación de contenido y representación de texto.
El bloque `public HeroChoice { ... }` valida los parámetros antes de aceptarlos.

`DraftState` también es un record. Cada fase devuelve un estado nuevo. Su
`toBuilder()` permite copiar el estado actual y cambiar solamente algunos
campos. Las listas y conjuntos se copian para evitar modificaciones externas.
Un record por sí solo no vuelve inmutables los objetos que guarda.

Un `enum` es un conjunto cerrado de valores:

```java
public enum DraftPhase {
    PREPARATION, MAP_TYPE_SELECTION, MAP_SELECTION, MAP_LOCKED,
    HERO_BANS, PLAYING, RESULT_PENDING, FINISHED
}
```

No se puede asignar cualquier texto como fase. El compilador exige uno de
estos valores. `MAP_LOCKED` distingue un mapa confirmado de uno todavía en
selección; así las reglas no dependen de adivinar la fase mirando campos nulos.

## 6. Una acción completa: vetar un héroe

Vamos a seguir `POST /draft/12/ban-hero` con este JSON:

```json
{ "heroId": 7, "teamId": 2 }
```

### Paso A: el controlador recibe HTTP

Abre `draft/bans/BanController.java`:

```java
@PostMapping("/draft/{id}/ban-hero")
public DraftView ban(@PathVariable long id,
        @AuthenticationPrincipal Jwt token,
        @Valid @RequestBody DraftRequests.BanHero request) {
    return bans.submit(id, access.actor(token), request);
}
```

`@PathVariable` toma `12` de la URL. `@RequestBody` convierte el JSON al record
`BanHero`. `@Valid` aplica restricciones como `@Positive`.
`@AuthenticationPrincipal` recibe la sesión que Spring Security ya verificó.

El controlador entrega la operación al servicio y devuelve un `DraftView`.
Spring convierte ese objeto a JSON. Las reglas de los cuatro bans están en
otro archivo.

### Paso B: el servicio coordina

Abre `draft/bans/BanService.java`. Su método `submit`:

1. Bloquea la partida y comprueba quién puede actuar por ese equipo.
2. Busca el héroe en el catálogo de PostgreSQL. El cliente no decide su rol.
3. Pide a `DraftWorkflow` ejecutar la regla de bans.
4. Guarda el estado resultante y prepara la respuesta.

`@Transactional` hace que la operación sea una unidad: si falla la regla o
el guardado, se revierten sus escrituras. Dos peticiones a la misma partida
esperan el bloqueo en vez de cambiar el mismo turno simultáneamente.

### Paso C: la fase valida las reglas

Abre `draft/bans/BanPhase.java`. Empieza así:

```java
public DraftState submitBan(DraftState state, long teamId, HeroChoice hero) {
    state.requirePhase(DraftPhase.HERO_BANS);
    state.requireTurn(teamId);
    List<BanSelection> bans = state.bans();
    // Después valida turnos, duplicados y límites por rol.
}
```

El método recibe un estado y devuelve otro `DraftState`. Esta clase usa datos
del dominio y no necesita una petición HTTP ni una conexión de base de datos.
Al cuarto turno cambia a `PLAYING`. Antes del cuarto, cambia al otro equipo.
`throw new DraftRuleViolation(...)` interrumpe una acción inválida.

También verás una expresión como:

```java
bans.stream().filter(ban -> ban.teamId() == teamId).count()
```

Es parecida a `bans.filter(ban => ban.teamId === teamId).length` en JavaScript.
`ban -> ...` es una lambda, una pequeña función. `stream()` permite recorrer,
filtrar y transformar una colección.

### Paso D: guardar y responder

`draft/data/DraftStore.java` compara el estado anterior con el nuevo. Inserta
una `DraftBanEntity`, actualiza la sesión y, si empezó el juego, guarda su hora.
`DraftViewMapper` devuelve el estado con catálogos, marcador, turno y reloj.

El camino es:

```text
HTTP → BanController → BanService → DraftCommands / DraftAccess
                                  → DraftWorkflow → BanPhase
                                  → DraftStore → repositorios → PostgreSQL
                                  → DraftViewMapper → JSON
```

## 7. Constructor, dependencia e inyección

En un controlador verás:

```java
private final BanService bans;

public BanController(BanService bans, DraftAccess access) {
    this.bans = bans;
    this.access = access;
}
```

`private final` dice que el campo solo se usa dentro de la clase y que su
referencia no se reasigna después del constructor. No significa que todo el
objeto al que apunta sea inmutable.

`this.bans` es el campo del objeto; `bans` es el parámetro que llegó al
constructor. La asignación conserva la referencia al servicio.

Spring crea `BanService` porque tiene `@Service`. Después lo entrega al
constructor de `BanController`, identificado por `@RestController`. Esto es
inyección de dependencias: declaramos lo que necesita cada clase. No hacemos
`new BanService(...)` dentro del controlador ni usamos variables globales.

## 8. Repositorios: una interfaz también es código útil

Abre `draft/data/DraftSessionRepository.java`:

```java
public interface DraftSessionRepository
        extends JpaRepository<DraftSessionEntity, Long> {
    Optional<DraftSessionEntity> findByMatchId(int matchId);
}
```

Una interfaz declara operaciones que otro objeto implementa. Aquí Spring Data
crea esa implementación al arrancar. `JpaRepository` aporta métodos como
`findById`, `save` y `delete`. El tipo `<DraftSessionEntity, Long>` significa
"trabaja con sesiones y sus identificadores son Long".

El nombre `findByMatchId` describe una consulta por el campo Java `matchId`.
`Optional` expresa que la fila puede no existir. Al llamar
`.orElseThrow(...)`, el código convierte esa ausencia en un error explícito.

Para las tablas públicas existentes usamos `MatchRepository` y `DraftCatalog`
con SQL parametrizado. Así se puede migrar el draft sin declarar entidades
JPA para todos los módulos del producto. Los `?` separan los valores de la
consulta y evitan concatenar datos del usuario como SQL.

## 9. Errores y tiempo son responsabilidades separadas

`DraftErrors` convierte errores del dominio en HTTP 409 y datos inválidos en
400. Sesión ausente/incorrecta devuelve 401; permisos insuficientes, 403.
No se envía al frontend el SQL de una excepción de PostgreSQL.

`TurnClock` calcula tiempo. `TurnTimeouts` decide qué hacer al vencer.
`DraftTimeoutScheduler` busca turnos vencidos y llama a un servicio transaccional.
Los vencimientos pasan por las mismas reglas que los clics. Una pausa es un
estado del reloj; no multiplica los valores del enum de fases.

## 10. Orden de estudio

1. **Hoy:** `DraftBanEntity`, `HeroChoice`, `DraftPhase`, `BanController` y
   `BanPhase`. Identifica clase, campo, constructor, método, record y enum.
2. **Después:** `BanService`, `DraftCommands` y `DraftAccess`. Sigue quién
   determina el equipo y quién valida el turno.
3. **Persistencia:** `DraftStore`, los tres repositorios y la migración SQL.
   Relaciona cada campo `@Column` con una columna real.
4. **Serie:** `ResultPhase`, `ResultService`, `PreparationPhase` y
   `MapTypePhase`. Sigue un empate y el turno del mapa siguiente.
5. **Operación:** pausa, scheduler y configuración de JWT.

Puedes empezar auditando estas preguntas en el código: ¿qué ocurre con
`heroId: null`?, ¿dónde se rechaza un héroe repetido?, ¿qué cambia en el cuarto
ban?, ¿qué dato obliga a elegir al perdedor en el siguiente mapa?

La API completa ahora está implementada en Java. El frontend conserva sus
rutas y consume el mismo JSON. La organización por fases hace visible dónde
vive cada regla; Java y Spring siguen necesitando ese trabajo de diseño.

## 11. El resto del backend y la base existente

`league/` contiene equipos, temporada, partidos y avance de playoffs;
`network/`, miembros y OAuth Discord; `stats/`, estadísticas; `catalog/`,
mapas y héroes; `news/`, noticias; `announcements/`, anuncios;
`minigames/`, Jeopardy; `familyfeud/`, preguntas, lobby y juego;
`practice/`, el panel de práctica; `common/`, permisos, SQL y archivos.

Las tablas públicas existentes siguen siendo PostgreSQL. Los repositorios
usan `JdbcTemplate` y `JsonSql` para preservar sus nombres, relaciones y
respuestas durante el cambio de lenguaje. No todas esas tablas tienen una
clase `@Entity`: JPA es una herramienta de persistencia, no un requisito de
Java. Las tablas nuevas del draft sí tienen entidades y repositorios JPA.

Flyway ejecuta los archivos `db/migration/V1...V5`. Hibernate valida el
esquema mediante `ddl-auto=validate`. No genera ni reemplaza las tablas.
`LegacyDraftMigrationService` convierte el historial anterior y verifica
marcadores antes de permitir arrancar la API Java. Los IDs de mapas retirados
se conservan en resultados históricos; el tipo ausente permanece nulo.

Para estudiar otra operación completa, sigue `MatchAdminController` →
`MatchAdminService` → `ScheduleNotifications`. Verás una transacción SQL
que guarda el horario y una cola persistente que entrega el aviso a Discord
con reintentos. Para leer el procedimiento de despliegue, abre
`migration-uidesign/DEPLOYMENT.md` en la raíz del repositorio.

## Documentación oficial consultada

- [Spring Data JPA: bloqueo de consultas](https://docs.spring.io/spring-data/jpa/reference/jpa/locking.html).
- [Spring Security: verificación de JWT](https://docs.spring.io/spring-security/reference/servlet/oauth2/resource-server/jwt.html).
- [Spring Framework: ejecución programada](https://docs.spring.io/spring-framework/reference/integration/scheduling.html).
- [Spring Boot: inicialización de bases de datos](https://docs.spring.io/spring-boot/how-to/data-initialization.html).
