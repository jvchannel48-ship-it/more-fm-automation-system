import { NextResponse } from 'next/server'
export const dynamic='force-dynamic'
export async function GET(){
 try {
  const url='https://newsdata.io/api/1/latest?apikey=pub_4b1ec47b99fd4f8a9be3475f69e0f979&language=en'
  const response=await fetch(url,{cache:'no-store'})
  const data=await response.json()
  if(!response.ok || data.status==='error') return NextResponse.json({error:data?.message||'News service unavailable'}, {status:502,headers:{'Cache-Control':'no-store'}})
  return NextResponse.json({results:data.results||[]},{headers:{'Cache-Control':'no-store'}})
 } catch { return NextResponse.json({error:'Unable to load news right now.'},{status:502,headers:{'Cache-Control':'no-store'}})}
}