import fs from 'fs'


export namespace ServiceProvider {

    export function load<T>(options: any): T {
        const { extensionName, commandName, ...rest } = options;
        const llmOptions = rest;

        const jsPath = `${process.env.HOME}/.config/enconvo/extension/${extensionName}/${commandName}.js`;

        const jsContent = fs.readFileSync(jsPath, "utf8");

        const finaleJsContent = `
            ${jsContent}
             module.exports.default(llmOptions)
        `;

        return eval(finaleJsContent) as T;
    }
}
