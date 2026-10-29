export function blueprintXml(b) {
  const attr=s=>String(s).replaceAll('&','&amp;').replaceAll('"','&quot;').replaceAll('<','&lt;').replaceAll('>','&gt;').replaceAll('\r','&#13;').replaceAll('\n','&#10;').replaceAll('\t','&#9;');
  const data=v=>'<![CDATA['+JSON.stringify(v).replaceAll(']]>',']]]]><![CDATA[>')+']]>';
  const f=b.flow;
  return '<?xml version="1.0" encoding="UTF-8"?>\n<blueprint schemaVersion="qa.blueprint/v1" id="'+attr(b.id)+'"'+(b.name?' name="'+attr(b.name)+'"':'')+'>\n'+
    '  <flow id="'+attr(f.id)+'" entryNode="'+attr(f.entryNode)+'"'+(f.name?' name="'+attr(f.name)+'"':'')+'>\n'+
    (f.variables?'    <variables>'+data(f.variables)+'</variables>\n':'')+
    (f.metadata?'    <metadata>'+data(f.metadata)+'</metadata>\n':'')+
    '    <nodes>\n'+f.nodes.map(n=>'      <node id="'+attr(n.id)+'" type="'+n.type+'"'+(n.action?' action="'+n.action+'"':'')+(n.timeoutMs?' timeoutMs="'+n.timeoutMs+'"':'')+'>'+
      ['params','condition','retry'].filter(k=>n[k]!==undefined).map(k=>'<'+k+'>'+data(n[k])+'</'+k+'>').join('')+'</node>').join('\n')+'\n    </nodes>\n'+
    '    <edges>\n'+f.edges.map(e=>'      <edge from="'+attr(e.from)+'" to="'+attr(e.to)+'"'+(e.label?' label="'+e.label+'"':'')+'/>').join('\n')+'\n    </edges>\n  </flow>\n'+
    ['selectors','target','testCase'].filter(k=>b[k]).map(k=>'  <'+k+'>'+data(b[k])+'</'+k+'>').join('\n')+'\n</blueprint>\n';
}

