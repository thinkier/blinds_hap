import jsyaml from "js-yaml"
import * as fs from "node:fs";

export interface HomeKitConfigFile {
    username: string,
    pincode: string
    port: number
}

export function readHomeKit(path = "config/homekit.yml"): HomeKitConfigFile {
    return jsyaml.load(fs.readFileSync(path, 'utf8')) as HomeKitConfigFile
}
