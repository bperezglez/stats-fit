# Catálogo de ejercicios — atribución

FitTrack incluye metadatos de ejercicios derivados del dataset abierto
[hasaneyldrm/exercises-dataset](https://github.com/hasaneyldrm/exercises-dataset)
(licencia MIT para los datos estructurados).

## Ilustraciones © Gym visual

Las **imágenes y animaciones GIF** de los ejercicios son propiedad de
**Gym visual** y se sirven bajo sus condiciones de uso habituales:

- Resolución máxima **180×180** píxeles en la app.
- **Atribución visible** a Gym visual en la interfaz cuando se muestren medios del catálogo.
- No redistribuir los archivos de medios fuera de esta aplicación sin permiso.

El catálogo reducido (`manifest.json` + `chunks/*.json`) y el código de FitTrack son independientes;
los medios grandes (`public/catalog/images/`, `public/catalog/videos/`) no se
versionan en git y deben generarse o copiarse localmente desde el dataset si se
necesitan en desarrollo.

## Regenerar el catálogo

```bash
git clone https://github.com/hasaneyldrm/exercises-dataset.git /tmp/exercises-dataset
npm run catalog:build
```

Opcionalmente, copia `images/` y `videos/` del dataset a `public/catalog/` para
previsualizar miniaturas en local.
