(() => {
  'use strict';
  const $ = (s, p = document) => p.querySelector(s);
  const read = (key, fallback) => {try{return JSON.parse(localStorage.getItem(key)) ?? fallback;}catch{return fallback;}};
  const save = (key, value) => {try{localStorage.setItem(key, JSON.stringify(value));}catch{}};
  const csrf = () => document.cookie.split('; ').find(x => x.startsWith('csrftoken='))?.split('=')[1] || $('[name=csrfmiddlewaretoken]')?.value || '';
  async function api(url, body, signal) {
    const response = await fetch(url, {method:body?'POST':'GET',credentials:'same-origin',headers:body?{'X-CSRFToken':csrf()}:{},body,signal});
    let data; try{data=await response.json();}catch{throw new Error('Сервер вернул неожиданный ответ. Обновите страницу и повторите.');}
    if(!response.ok) {const error=new Error(data.error || 'Проверьте введённые данные.');error.data=data;throw error;}
    return data;
  }
  const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
  let timer;
  function notice(message, error=false) {const n=$('#notice');n.textContent=message;n.className='alert notice '+(error?'alert-danger':'alert-success');clearTimeout(timer);timer=setTimeout(()=>n.classList.add('d-none'),5000);}
  $('#theme-toggle')?.addEventListener('click',()=>{const theme=document.documentElement.dataset.bsTheme==='dark'?'light':'dark';document.documentElement.dataset.bsTheme=theme;try{localStorage.setItem('africa-theme',theme);}catch{}});
  document.addEventListener('click', async event => {
    const button=event.target.closest('[data-favorite]');
    if(button && !button.disabled){button.disabled=true;try{const data=await api('/api/favorites/'+button.dataset.favorite+'/',new URLSearchParams({active:button.getAttribute('aria-pressed')==='true'?'0':'1'}));button.setAttribute('aria-pressed',String(data.active));button.textContent=data.active?'♥':'♡';document.querySelectorAll('[data-favorite-count]').forEach(n=>n.textContent=data.count);notice(data.active?'Тур добавлен в избранное':'Тур удалён из избранного');if($('#favorites-grid')&&!data.active){button.closest('.tour-column').remove();if(!$('#favorites-grid .tour-column'))$('#favorites-grid').innerHTML='<div class="col-12"><div class="card empty p-5"><h3>В избранном пока пусто</h3><p>Добавьте туры из каталога.</p></div></div>';}}catch(e){notice(e.message,true);}finally{button.disabled=false;}}
    const cancel=event.target.closest('[data-cancel]');
    if(cancel&&!cancel.disabled){if(!confirm('Отменить эту заявку?'))return;cancel.disabled=true;try{const data=await api('/api/bookings/'+cancel.dataset.cancel+'/cancel/',new URLSearchParams({confirm:'1'}));const badge=$('#status-'+cancel.dataset.cancel);badge.textContent=data.label;badge.className='badge bg-secondary-lt';cancel.remove();notice('Заявка отменена');}catch(e){notice(e.message,true);cancel.disabled=false;}}
  });
  const filters=$('#filters');
  if(filters){
    const results=$('#tour-results');let controller,delay;
    const values=read('africa-filters',{});
    Object.entries(values).forEach(([key,value])=>{if(filters.elements.namedItem(key))filters.elements.namedItem(key).value=value;});
    const layout=value=>{results.classList.toggle('catalog-list',value==='list');document.querySelectorAll('[data-layout]').forEach(b=>{b.classList.toggle('active',b.dataset.layout===value);b.setAttribute('aria-pressed',String(b.dataset.layout===value));});save('africa-layout',value);};
    layout(read('africa-layout','grid'));
    document.querySelectorAll('[data-layout]').forEach(b=>b.addEventListener('click',()=>layout(b.dataset.layout)));
    async function update(){
      controller?.abort();controller=new AbortController();const signal=controller.signal;
      const params=new URLSearchParams(new FormData(filters));save('africa-filters',Object.fromEntries(params));
      results.setAttribute('aria-busy','true');$('#filter-error').classList.add('d-none');
      try{const data=await api('/api/tours/?'+params,null,signal);results.innerHTML=data.html;$('#result-count').textContent='Найдено туров: '+data.count;}
      catch(e){if(e.name!=='AbortError'){const error=$('#filter-error');error.textContent=e.message;error.classList.remove('d-none');}}
      finally{if(!signal.aborted)results.setAttribute('aria-busy','false');}
    }
    filters.addEventListener('submit',e=>{e.preventDefault();clearTimeout(delay);update();});
    filters.addEventListener('input',()=>{clearTimeout(delay);delay=setTimeout(update,320);});
    filters.addEventListener('change',()=>{clearTimeout(delay);update();});
    filters.addEventListener('reset',()=>{clearTimeout(delay);setTimeout(update,0);});
    update();
  }
  const form=$('#booking-form');
  if(form){
    const date=$('#departure');const now=new Date();const localDate=d=>[d.getFullYear(),String(d.getMonth()+1).padStart(2,'0'),String(d.getDate()).padStart(2,'0')].join('-');date.min=localDate(now);const max=new Date(now);max.setDate(max.getDate()+730);date.max=localDate(max);
    let quoteController;
    async function quote(){quoteController?.abort();quoteController=new AbortController();try{const data=await api('/api/quote/',new FormData(form),quoteController.signal);$('#quote-total').textContent=money(data.total);}catch(e){if(e.name!=='AbortError')$('#quote-total').textContent=e.message;}}
    $('#travelers').addEventListener('input',quote);
    form.addEventListener('submit',async e=>{
      e.preventDefault();if(!form.reportValidity())return;
      const button=$('button[type=submit]',form);button.disabled=true;
      const message=$('#booking-message');message.className='alert d-none';
      try{const data=await api('/api/bookings/',new FormData(form));message.className='alert alert-success';message.textContent=data.message;const link=document.createElement('a');link.href='/bookings/';link.className='d-block mt-2';link.textContent='Перейти к моим заявкам →';message.append(link);form.reset();await quote();}
      catch(error){message.className='alert alert-danger';const labels={tour:'Тур',name:'Имя',email:'Почта',departure:'Дата',travelers:'Туристов',consent:'Согласие'};message.textContent=error.data?.errors?Object.entries(error.data.errors).flatMap(([key,errors])=>errors.map(item=>(labels[key]||key)+': '+item.message)).join(' '):error.message;}
      finally{button.disabled=false;}
    });
  }
})();
