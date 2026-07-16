# Publicar la ficha e instalarla en el iPad Pro

Esta carpeta es la app completa. Son 7 archivos y funcionan juntos:

| Archivo | Para qué sirve |
|---|---|
| `index.html` | La ficha entera (formulario, cálculos, historial) |
| `manifest.webmanifest` | Nombre e iconos al instalarla |
| `sw.js` | Hace que abra sin conexión |
| `icon-180.png` | Icono del iPad (pantalla de inicio) |
| `icon-192.png` / `icon-512.png` / `icon-maskable-512.png` | Iconos para Android y catálogo |

**Súbelos los 7 juntos, en la misma carpeta.** Si falta `sw.js` deja de funcionar sin conexión; si falta `manifest.webmanifest` no se instala como app.

---

## Publicar en GitHub Pages (gratis, URL estable)

1. Entra en <https://github.com> con tu cuenta (o créala).
2. **New repository** → nombre: `ficha-pododepor` → **Public** → *Create repository*.
   - Tiene que ser público para que Pages funcione en cuenta gratuita. Recuerda: aquí solo va la ficha en blanco, **ningún dato de paciente**. Los datos de tus pacientes nunca salen del iPad.
3. En el repo: **Add file** → **Upload files** → arrastra los **7 archivos** de esta carpeta → *Commit changes*.
4. **Settings** → **Pages** (menú izquierdo) → en *Branch* elige `main` y carpeta `/ (root)` → **Save**.
5. Espera 1-2 minutos y recarga. Arriba aparecerá tu dirección:
   `https://TUUSUARIO.github.io/ficha-pododepor/`

## Instalar en el iPad Pro

1. Abre esa dirección **en Safari** (no vale Chrome: en iPad solo Safari puede instalar apps en la pantalla de inicio).
2. Botón **Compartir** (el cuadrado con la flecha) → **Añadir a pantalla de inicio** → *Añadir*.
3. Ya tienes el icono "Ficha PD" en la pantalla de inicio. Ábrelo desde ahí **siempre**.

Abierta así funciona a pantalla completa, sin barra de Safari, y **sin conexión** en la consulta.

---

## Dos avisos importantes

**1. El historial no se muda solo.**
Las fichas que ya tengas guardadas abriendo el archivo desde Archivos/OneDrive **no aparecerán** en la app instalada: el navegador las guarda por dirección, y la dirección ha cambiado. Para llevártelas:
- En la versión vieja: 🗂 Historial → **Exportar copia** (te baja un `.json`).
- En la app nueva ya instalada: 🗂 Historial → **Importar copia** → elige ese `.json`.

**2. Cuando actualices la ficha.**
Si cambias `index.html`, abre `sw.js` y sube el número de `CACHE_VERSION` (por ejemplo de `pododepor-v6.0.0` a `pododepor-v6.0.1`) antes de subirlo. Si no lo haces, el iPad seguirá abriendo la versión antigua guardada en caché. La app te avisará con un mensaje cuando detecte versión nueva; ciérrala del todo y ábrela para aplicarla.

---

## La contraseña y el cifrado

La primera vez que abras la app te pedirá **crear una contraseña** (mínimo 8 caracteres). A partir de ahí:

- Todo el historial se guarda **cifrado** (AES-256) en el iPad. Sin la contraseña, en el almacenamiento no hay más que texto ilegible: ni números de historia, ni diagnósticos, ni nada.
- La app **se bloquea sola** a los 10 minutos sin tocarla, y también si sales a otra app más de 5 minutos. Tu ficha a medias no se pierde: sigue ahí al desbloquear.
- Botón **🔒 Bloquear ahora** en el historial, para cuando te levantes de la consulta.
- Botón **🔑 Cambiar contraseña**, que vuelve a cifrar todo con la nueva.

**⚠ Apunta la contraseña en un lugar seguro. No hay forma de recuperarla.** No es que sea incómodo pedirla: es que no existe ninguna copia en ninguna parte. Si la olvidas, las fichas guardadas se pierden de forma definitiva. Es el precio de que nadie más pueda abrirlas.

## Copias de seguridad

Los datos viven **solo en el iPad**. Exporta la copia de vez en cuando (🗂 Historial → **Exportar copia**).

El archivo que se descarga **va cifrado con tu contraseña**, así que puedes guardarlo en OneDrive sin exponer datos de salud. Para restaurarlo en otro dispositivo: **Importar copia** y, si la contraseña de ese aparato es distinta, te la pedirá.

Si borras los datos de Safari, restauras el iPad o cambias de dispositivo, esa copia es lo único que recupera tus fichas.
