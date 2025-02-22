import jsyaml from "js-yaml"
import * as fs from "node:fs";
import * as os from "node:os";
import {ChannelBound, WindowDressingState} from "../model/common";

export interface PersistenceFile {
    states: (ChannelBound & {
        state: WindowDressingState
    })[]
}

export function readStates(path = "persist/blinds.yml"): PersistenceFile {
    return jsyaml.load(fs.readFileSync(path, 'utf8')) as PersistenceFile
}

export function writeStates(state: PersistenceFile, path = "persist/blinds.yml") {
    let str = "# This file is auto generated and should not be modified unless you know what you're doing." + os.EOL;
    str += jsyaml.dump(state);

    fs.writeFileSync(path, str);
}
