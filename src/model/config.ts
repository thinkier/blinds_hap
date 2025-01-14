import jsyaml from "js-yaml"
import * as fs from "node:fs";
import {ChannelBound} from "./common";

export type WindowDressingInstanceConfig = ChannelBound & {
    full_cycle_steps: number,
    reverse?: boolean,
    full_tilt_steps?: number
}

export interface ConfigFile {
    instances: WindowDressingInstanceConfig
}

export function readConfig(path = "config.yml"): ConfigFile {
    return jsyaml.load(fs.readFileSync(path, 'utf8')) as ConfigFile
}
