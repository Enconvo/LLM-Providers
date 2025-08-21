import { NativeAPI, environment } from "@enconvo/api"
import path from "path"

export namespace ImageUtil {
    export const compressImage = async (url: string): Promise<string> => {
        console.time("compress_image")
        const compressResult = await NativeAPI.callCommand("compress_image|image_compress", {
            destinationFolderPath: path.join(environment.cachePath, 'tmp', 'images'),
            overwrite: false,
            quality: 50,
            image_files: [url]
        })
        console.timeEnd("compress_image")
        if (compressResult.data?.[0]) {
            return compressResult.data[0]
        }
        return url
    }
}