import jsyaml from "js-yaml"
import * as fs from "node:fs";
import {Channel, WindowDressingState} from "./common";

export interface PersistenceFile {
    states: {
        channel: Channel,
        state: WindowDressingState
    }
}

export function readStates(path = "persistence.yml"): PersistenceFile {
    return jsyaml.load(fs.readFileSync(path, 'utf8')) as PersistenceFile
}

export function writeStates(path = "persistence.yml", state: PersistenceFile) {
    let str = "# This file is auto generated and should not be modified unless you know what you're doing.\r\n";
    str += jsyaml.dump(state);

    fs.writeFileSync(path, str);
}
