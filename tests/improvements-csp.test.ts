import {expect,it,vi} from 'vitest';
import {POST} from '@/app/api/csp-report/route';
import {reportOnlyCsp} from '@/lib/http/csp';
it('accepts both browser reporting formats without logging sensitive URLs or samples',async()=>{
 const log=vi.spyOn(console,'info').mockImplementation(()=>{});
 try {
  for(const body of [{'csp-report':{'effective-directive':'script-src-elem','document-uri':'https://example.com/?token=PRIVATE','script-sample':'PRIVATE'}},[{type:'csp-violation',body:{effectiveDirective:'connect-src',documentURL:'PRIVATE'}}]]){
   const response=await POST(new Request('http://localhost/api/csp-report',{method:'POST',headers:{'content-type':'application/reports+json'},body:JSON.stringify(body)}));expect(response.status).toBe(204);
  }
  expect(JSON.stringify(log.mock.calls)).not.toContain('PRIVATE');expect(log.mock.calls).toHaveLength(2);
 } finally {log.mockRestore();}
});
it('bounds reports and rejects unsupported content types',async()=>{
 expect((await POST(new Request('http://localhost',{method:'POST',headers:{'content-type':'text/plain'},body:'{}'}))).status).toBe(415);
 expect((await POST(new Request('http://localhost',{method:'POST',headers:{'content-type':'application/json'},body:'x'.repeat(17000)}))).status).toBe(413);
 expect(reportOnlyCsp).toContain('report-uri /api/csp-report');expect(reportOnlyCsp).toContain('report-to csp');
});
