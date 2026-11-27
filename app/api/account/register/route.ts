import {NextResponse} from 'next/server'
import {readJson,writeJson} from '@/lib/storage'
import {scryptSync,randomBytes,timingSafeEqual} from 'node:crypto'
type Account={name:string;username:string;hash:string;salt:string;createdAt:string}
const PATH='accounts/ysfm-users.json'
export async function POST(req:Request){try{const {name,password}=await req.json();if(typeof name!=='string'||typeof password!=='string'||name.trim().length<2||name.trim().length>60||password.length<8||password.length>128)return NextResponse.json({error:'Name must be 2–60 characters and password 8–128 characters.'},{status:400});const accounts=await readJson<Account[]>(PATH,[]);const username=name.trim().toLowerCase();if(accounts.some(a=>a.username===username))return NextResponse.json({error:'Name already registered.'},{status:409});const salt=randomBytes(16).toString('hex');const hash=scryptSync(password,salt,64).toString('hex');accounts.push({name:name.trim(),username,hash,salt,createdAt:new Date().toISOString()});await writeJson(PATH,accounts);return NextResponse.json({ok:true},{status:201})}catch{return NextResponse.json({error:'Registration service unavailable.'},{status:500})}}
