# Helpers

Este paquete incluye funciones para:
* Validar cedula de identidad y electoral dominicana. [Video](https://www.youtube.com/watch?v=__Ko7VxoCuU&t=179s)
* Agregar formato a cadenas de texto
* Generar documentos PDF a partir de plantillas HTML

## Ejemplos
```ts
import { duiIsValid, format, pdf } from 'ldss95@helpers'

if(duiIsValid('402256688353')){
    //Do something
}

const phone = format.phone('8094260093')
// (809) 426 - 0093

const code = format.custom('8078', 'XXXX - XXXX - XXXX - XXXX')

```