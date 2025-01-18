import jsyaml from "js-yaml"
import * as fs from "node:fs";
import {ChannelBound, WindowDressingInstance} from "./common";

export type WindowDressingInstanceConfig = ChannelBound & WindowDressingInstance & {
    uuid: string,
    stallguard_threshold?: number
}

export interface ConfigFile {
    instances: WindowDressingInstanceConfig[]
}

export function readConfig(path = "config.yml"): ConfigFile {
    return jsyaml.load(fs.readFileSync(path, 'utf8')) as ConfigFile
}
