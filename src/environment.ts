import fs from "fs";
import os from "os";
import path from "path";
export const environment = {
    enconvoVersion: process.env.enconvoVersion ?? "",
    extensionName: process.env.extensionName ?? "",
    commandName: process.env.commandName ?? "",
    assetsPath: `${process.env.HOME}/.config/enconvo/extension/${process.env.extensionName}/assets`,
    supportPath: fs.existsSync(path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/support/${process.env.extensionName}/${process.env.commandName}/`)) ? path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/support/${process.env.extensionName}/${process.env.commandName}/`) : (fs.mkdirSync(path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/support/${process.env.extensionName}/${process.env.commandName}/`), { recursive: true }) ? path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/support/${process.env.extensionName}/${process.env.commandName}/`) : ""),
    cachePath: fs.existsSync(path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/cache/${process.env.extensionName}/${process.env.commandName}/`)) ? path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/cache/${process.env.extensionName}/${process.env.commandName}/`) : (fs.mkdirSync(path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/cache/${process.env.extensionName}/${process.env.commandName}/`), { recursive: true }) ? path.join(os.homedir(), `Library/Caches/com.frostyeve.enconvo/cache/${process.env.extensionName}/${process.env.commandName}/`) : ""),
    isDevelopment: (process.env.isDevelopment ?? true) as boolean,
    textSize: "medium",
    launchType: "user",
    canAccess: function (api: unknown): boolean {
        // Implementation for checking access to an API
        // This is just an example and should be replaced with actual logic

        return true;
    },
};