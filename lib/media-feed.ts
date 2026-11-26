import 'server-only'
import { readJson, writeJson } from './storage'
export type Reaction = 'like'|'love'|'haha'|'wow'|'sad'|'angry'
export type Post = {id:string; text:string; image?:string; createdAt:string; reactions:Record<Reaction,number>; userReactions:Record<string,Reaction>}
const PATH='station/media-posts.json'
export async function getPosts():Promise<Post[]> { return readJson<Post[]>(PATH,[]) }
export async function savePosts(p:Post[]) { await writeJson(PATH,p) }
