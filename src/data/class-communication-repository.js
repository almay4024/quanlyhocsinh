// Local persistence boundary for class chat and activity events.
const storageKey=(classId,date)=>`lopvui.class-communication.v1.${classId}.${date}`;

export function loadClassCommunication(classId,date,storage=localStorage){
  try{
    const saved=JSON.parse(storage.getItem(storageKey(classId,date))||'null');
    return {messages:Array.isArray(saved?.messages)?saved.messages:[],activity:Array.isArray(saved?.activity)?saved.activity:[],notifications:Array.isArray(saved?.notifications)?saved.notifications:[]};
  }catch{
    return {messages:[],activity:[],notifications:[]};
  }
}

export function saveClassCommunication(classId,date,communication,storage=localStorage){
  try{
    storage.setItem(storageKey(classId,date),JSON.stringify({messages:communication.messages||[],activity:communication.activity||[],notifications:communication.notifications||[]}));
  }catch{}
}
