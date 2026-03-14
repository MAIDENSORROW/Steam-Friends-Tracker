let audio=null;
chrome.runtime.onMessage.addListener((msg,sender,sendResponse)=>{
  if(msg.type==='PLAY'){
    if(audio)audio.pause();
    audio=new Audio(msg.url);audio.loop=true;audio.volume=0.7;
    audio.play().then(()=>sendResponse({ok:true})).catch(e=>sendResponse({ok:false}));
    return true;
  }
  if(msg.type==='PAUSE'){if(audio)audio.pause();sendResponse({ok:true});return true;}
  if(msg.type==='STOP'){if(audio){audio.pause();audio=null;}sendResponse({ok:true});return true;}
});