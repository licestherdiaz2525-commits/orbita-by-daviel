const planetas = [
['Mercurio','Rocoso','El planeta más cercano al Sol tiene una superficie cubierta de cráteres. Su atmósfera es tan tenue que apenas retiene calor durante la noche.','radial-gradient(circle at 31% 42%,#756d65 4%,transparent 9%),radial-gradient(circle at 60% 26%,#6e655c 5%,transparent 10%),repeating-radial-gradient(ellipse at 70% 80%,#999086,#b4a99b 7%,#918781 12%)'],
['Venus','Rocoso','Una densa atmósfera de dióxido de carbono atrapa el calor en su superficie. Por eso Venus es el planeta más caliente del sistema solar.','repeating-linear-gradient(11deg,#a97143,#e1b678 14%,#d79e65 22%,#efce96 30%)'],
['Tierra','Rocoso','El agua líquida cubre gran parte de su superficie. Desde el espacio se distinguen océanos, continentes y remolinos de nubes.','radial-gradient(ellipse at 70% 26%,#7a8c63 12%,transparent 15%),radial-gradient(ellipse at 28% 48%,#7b9273 15%,transparent 18%),linear-gradient(22deg,#347ba4 35%,#bccbd2 42%,#367599 49%,#305e85)'],
['Marte','Rocoso','El óxido de hierro presente en el polvo le da a Marte su color rojizo. Antiguos cauces indican que en el pasado fluyó agua por su superficie.','repeating-radial-gradient(ellipse at 22% 62%,#bf7151,#995138 16%,#c97a56 29%,#a35b41 37%)'],
['Júpiter','Gigante gaseoso','Es el planeta más grande del sistema solar. Entre sus bandas de nubes se distingue la Gran Mancha Roja, una enorme tormenta.','repeating-linear-gradient(0deg,#b18870,#dbc3a2 9%,#987761 17%,#e7d9c5 25%)'],
['Saturno','Gigante gaseoso','Sus anillos están formados principalmente por partículas de hielo. Cada partícula sigue su propia órbita alrededor del planeta.',''],
['Urano','Gigante helado','Su eje de rotación está tan inclinado que parece girar de lado mientras recorre su órbita alrededor del Sol.','linear-gradient(13deg,#69a5aa,#b7dcdd)'],
['Neptuno','Gigante helado','Es el planeta más alejado del Sol. En su atmósfera se forman tormentas y soplan vientos que superan la velocidad del sonido en la Tierra.','repeating-linear-gradient(4deg,#4875ae,#6897c1 15%,#5982b2 28%)']
];
const fichas = [
 ['58 millones de km','88 días','Mercurio gira tres veces sobre su eje por cada dos vueltas al Sol. Por esa combinación, de un amanecer al siguiente transcurren unos 176 días terrestres.','mercury'],
 ['108 millones de km','225 días','Venus tarda unos 243 días terrestres en girar sobre su eje. Su rotación es más lenta que su vuelta alrededor del Sol y tiene sentido contrario al de la Tierra.','venus'],
 ['150 millones de km','365,25 días','El eje terrestre está inclinado unos 23,4°. Mientras la Tierra recorre su órbita, esa inclinación cambia el ángulo de la luz y la duración del día en cada hemisferio. Así se producen las estaciones.','earth'],
 ['228 millones de km','687 días','Marte tiene una atmósfera tenue, compuesta principalmente por dióxido de carbono. En sus polos se encuentran depósitos de hielo, y sus dos pequeñas lunas se llaman Fobos y Deimos.','mars'],
 ['778 millones de km','11,9 años','Júpiter está compuesto principalmente por hidrógeno y helio. Bajo las nubes la presión aumenta tanto que el hidrógeno se vuelve líquido. No hay una superficie sólida como la que pisamos en la Tierra.','jupiter'],
 ['1.400 millones de km','29,5 años','Titán, su luna más grande, tiene una atmósfera densa y lagos de metano y etano líquidos. En otra luna, Encélado, salen chorros de vapor y partículas de hielo desde grietas cercanas al polo sur.','saturn'],
 ['2.900 millones de km','84 años','El metano de su atmósfera absorbe parte de la luz roja, lo que contribuye a su tono azul verdoso. Su inclinación extrema permite que cada polo pase décadas bajo la luz solar y después décadas en la oscuridad.','uranus'],
 ['4.500 millones de km','165 años','Tan lejos del Sol, Neptuno recibe muy poca luz. Su mayor luna, Tritón, recorre su órbita en sentido contrario a la rotación del planeta. Esa pista sugiere que la gravedad de Neptuno pudo haberla capturado.','neptune']
];
const dialogo=document.querySelector('dialog');
planetas.forEach(([nombre,tipo,detalle,superficie],i)=>{
 const tarjeta=document.createElement('button');
 tarjeta.className='card';
 tarjeta.style.setProperty('--surface',superficie);
 tarjeta.innerHTML='<small>ÓRBITA 0'+(i+1)+'</small>'+(superficie?'<span class="planet"></span>':'<img src="saturno.webp" alt="">')+'<strong>'+nombre+'</strong><span class="arrow" aria-hidden="true">↗</span>';
 tarjeta.onclick=()=>{document.querySelector('#tipo').textContent=tipo+' · Órbita '+(i+1);document.querySelector('#nombre').textContent=nombre;document.querySelector('#detalle').textContent=detalle;const [distancia, periodo, rasgo, ruta] = fichas[i];
 document.querySelector('#medidas').innerHTML = '<dt>Distancia media al Sol</dt><dd>≈ '+distancia+'</dd><dt>Tiempo para completar una órbita</dt><dd>≈ '+periodo+' terrestres</dd>';
 document.querySelector('#rasgo').textContent = rasgo;
 document.querySelector('#fuente').href = 'https://science.nasa.gov/'+ruta+'/facts/';
 dialogo.showModal()};
 document.querySelector('.grid').append(tarjeta);
});
dialogo.querySelector('button').onclick=()=>dialogo.close();
const cielo=document.querySelector('.sky');
for(let i=0;i<140;i++){const estrella=document.createElement('i');estrella.style.cssText='left:'+Math.random()*100+'%;top:'+Math.random()*100+'%;width:2px;height:2px;opacity:'+Math.random()*.55;cielo.append(estrella)}
