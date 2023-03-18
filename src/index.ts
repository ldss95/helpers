import fs from 'fs'
import puppeteer, { PDFOptions } from 'puppeteer';
import handlebars from 'handlebars'

interface PdfToFileParams {
	templatePath: string;
	context: object;
	options?: PDFOptions;
	filename: string;
	outDir: string;
}

/**
 * Verifica la validez de cedulda de identidad y electoral doninicana
 * {@link https://www.youtube.com/watch?v=__Ko7VxoCuU&t=179s Video}
 * @param dui Numero de cedula *Sin guiones*
 */
function duiIsValid(dui: string): boolean {
	//La cedula es invalida hasta que se demuestre lo conrario
	let isValid: boolean = false;

	//Si no tiene una longitud de 11 caracteres no es valida
	if (!dui || dui.length != 11) {
		return isValid;
	}
	
	//Si tiene algun caracter no numerico no es valida
	if (dui.replace(/[0-9]/g, '') != '') {
		return false;
	}

	//Suma los digitos individuales de un numero (16 = 1 + 6 = 7)
	const separateAndSum = (number: number) => {
		const numbers: string[] = number.toString().split('')
		const leftDigit: number = Number(numbers[0])
		const rightDigit: number = Number(numbers[1])

		return leftDigit + rightDigit
	}

	const digits: string[] = dui.split('');
	//Quitamos el ultimo digito del array y lo guardamos para validar al final
	const lastDigit: number = Number(digits.pop());

	const sum: number =
		digits.map((digit: string | number, index: number) => {
			digit = Number(digit);
			const multiplier: number = (index % 2) ? 2 : 1;

			const result: number = digit * multiplier
				
			return (result > 9)
				? separateAndSum(result)
				: result;
		}).reduce((total, n) => total + n, 0);

	const topTen: number = (Math.floor(sum / 10) + 1) * 10;
	const validator: number = topTen - sum

	if (lastDigit == validator || (lastDigit === 0 && validator === 10)) {
		isValid = true;
	}

	return isValid;
}

/**
 * Funcciones para transformar entradas agregando formatos.
 */
const format = {
	/**
	 * RNC, Registro Nacional de Contribuyente
	 * @param rnc `string` *sin guiones*
	 * 
	 * @example
 	 * 		format.rnc('130800035');
	 * 
	 * @returns `string` RNC con formato `130-80003-5`
	 */
	rnc: function (rnc: string): string {
		return this.custom(rnc, '000-00000-0')
	},

	/**
	 * Cedula de identidad y electoral dominicana
	 * @param dui numero de cedula *sin guiones*
	 * 
	 * @example
 	 * 		format.dui('10225088357');
	 * 
	 * @returns `string` Cedula con formato `102-2508835-7`
	 */
	dui: function (dui: string): string {
		return this.custom(dui, '000-0000000-0')
	},
	
	/**
	 * Numero de telefono dominicano
	 * @param phone numero telefonico *sin guiones ni espacios ni parentesis*
	 * 
	 * @example
 	 * 		format.phone('8093458812');
	 * 
	 * @returns `string` Numero Telefonico con formato `(809) 345-8812`
	 */
	phone: function (phone: string): string {
		return this.custom(phone, '(000) 000-0000')
	},
	
	/**
	 * Formato Moneda
	 * @param cash Monto
	 * @param decimals `0 | 1 | 2` Cantidad de decimales, Por defecto 0
	 * 
	 * @example
 	 * 		format.cash(4623, 2); -> '4,623.00'
 	 * 		format.cash(4623, 1); -> '4,623.0'
 	 * 		format.cash(4623);    -> '4,623'
	 *
	 * @returns Monto con format de moneda `9,000.00`
	 */
	cash: function (amount: number, decimals: 0 | 1 | 2 = 0): string {
		return Intl.NumberFormat('es-DO', { minimumFractionDigits: decimals }).format(amount)
	},

	/**
	 * Formatea cadenas de texto segun ejemplo introducido
	 * @param input texto sin formato
	 * @param example ejemplo de texto formateado
	 * 
	 * @example
	 * 		format.custom('99511469110', '0000-0000-00-0');
	 */
	custom: function(input: string, example: string): string {
		/**
		 * Validamos que la longitud del ejemplo (tras remover los caracaters especiales)
		 * sea la misma que la del input
		 */
		if (input.length != example.replace(/[^0-0A-Za-z]/g, '').length) {
			return 'Entrada Invalida'
		}
	
		const inputArr = input.split('')
	
		//Expresion regular para encontrar caracteres eseciales
		const isSpecial = new RegExp(/[^0-9A-Za-z]/)
	
		//Obtenemos los caracteres especiales y sus posiciones
		example.split('').forEach((char: string, index: number) => {
			if (isSpecial.test(char))
				inputArr.splice(index, 0, char)
		})
	
		return inputArr.join('')
	}
}

const phantomPath = '../node_modules/phantomjs/bin/phantomjs' 
/**
 * Generador de pdf asincrono, tomando como entrada una plantilla handlebars y los paramstros para la misma
 */
const pdf = {
	/**
	 * Genera pdf y lo devuelve en formato stream
	 * @return `fs.ReadStream`
	 * @param templatePath ruta de la platilla handlebars
	 * @param context parametros para la plantilla handlebars
	 * @param options opciones de configuracion para el documento pdf {@link https://www.npmjs.com/package/html-pdf#options Ver Documentacion}.
	 */
	toStream: async (templatePath: string, context: object, options?: PDFOptions) => {
		try {
			const template = fs.readFileSync(templatePath, 'utf8');
			const html = handlebars.compile(template)(context);
			const browser = await puppeteer.launch({
				args: ['--no-sandbox']
			});
			const page = await browser.newPage();
			await page.setContent(html);
			const pdfBuffer = await page.pdf({
				format: 'A4',
				printBackground: true,
				...options
			});
			await browser.close();
			return fs.createReadStream('', { start: 0, end: pdfBuffer.length - 1 });
		} catch (error) {
			throw error;
		}
	},

	/**
	 * Genera pdf y lo devuelve en formato buffer
	 * @return `fs.ReadStream`
	 * @param templatePath ruta de la platilla handlebars
	 * @param context parametros para la plantilla handlebars
	 * @param options opciones de configuracion para el documento pdf {@link https://www.npmjs.com/package/html-pdf#options Ver Documentacion}.
	 */
	toBuffer: async (templatePath: string, context: object, options?: PDFOptions) => {
		try {
			const template = fs.readFileSync(templatePath, 'utf8');
			const html = handlebars.compile(template)(context);
			const browser = await puppeteer.launch({
				args: ['--no-sandbox']
			});
			const page = await browser.newPage();
			await page.setContent(html);
			return await page.pdf({
				format: 'A4',
				printBackground: true,
				...options
			});
		} catch (error) {
			throw error;
		}
	},

	/**
	 * Genera pdf y lo guarda en la ruta especificada, devuelve la informacion del archivo generado
	 * @return `FileInfo`
	 * @param {PdfToFileParams} params objeto con los parametros para generar el pdf
	 * @param options opciones de configuracion para el documento pdf {@link https://www.npmjs.com/package/html-pdf#options Ver Documentacion}.
	 */
	toFile: async (params: PdfToFileParams) => {
		try {
			const template = fs.readFileSync(params.templatePath, 'utf8');
			const html = handlebars.compile(template)(params.context);
			const browser = await puppeteer.launch({
				args: ['--no-sandbox']
			});
			const page = await browser.newPage();
			await page.setContent(html);
			const buffer = await page.pdf({
				format: 'A4',
				printBackground: true,
				...params.options
			});
			await browser.close();
			fs.writeFileSync(params.outDir + params.filename, buffer);
		} catch (error) {
			throw error;
		}
	}
}

export { duiIsValid, format, pdf, handlebars };