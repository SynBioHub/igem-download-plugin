import { Request, Response } from 'express'
import { SBOL2Graph, S2Identified } from 'sbolgraph'
import { Config } from '../lib/config'
import { create, FileInfo } from 'html-pdf'
import { ReadStream } from 'fs'
import * as request from 'request'

const postprocess_igem = require('../lib/postprocess_igem')


let topLevelPredicate: string = "http://wiki.synbiohub.org/wiki/Terms/synbiohub#topLevel"
let wasDerivedFromPredicate: string = "http://www.w3.org/ns/prov#wasDerivedFrom"

function getSuffix(requestType: string) {
    switch (requestType) {
        case "main": {
            return "?action=render"
        }
        case "design": {
            return ":Design?action=render"
        }
        case "experience": {
            return ":Experience?action=render"
        }
        default: {
            throw new Error("Invalid request type!")
        }
    }
}

async function run(req: Request, res: Response) {
    let config = new Config()
    let sbolUrl: string = req.body.shallow_sbol
    let topLevelUri: string = req.body.top_level

    console.log(req.body)

    let graph: SBOL2Graph = await SBOL2Graph.loadURL(sbolUrl)
    let topLevel = graph.uriToFacade(topLevelUri)

    if (topLevel == undefined) {
        res.send("<b>Plugin error</b>")
        return
    }

    let wasDerivedFrom = topLevel.getProperties(wasDerivedFromPredicate)
        .find(wdf => wdf.object.toString().startsWith("http://parts.igem.org/"))
    
    if (wasDerivedFrom == undefined) {
        res.sendStatus(404).end()
        return
    }

    wasDerivedFrom = wasDerivedFrom.object.toString()
    let suffix = getSuffix(req.params.type)

    request.get(wasDerivedFrom + suffix, (err: any, resp: any, body: any) => {
        if (err || res.statusCode > 300) {
            return
        }

        let processed_body = postprocess_igem(body)

        create(processed_body).toFile('igem.pdf', (err: Error, fi: FileInfo) => {})

        create(processed_body).toStream((err: Error, stream: ReadStream) => {
            if (err) {
                console.error(err)
                return
            }

            res.attachment('igem.pdf')
            stream.pipe(res)
            return
        })
    })
}

export {
    run
}
