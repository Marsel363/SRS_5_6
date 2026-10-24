/* СРС №6: JSON REST API, единое состояние и независимые каналы запросов. */
(() => {
    'use strict';
    const root = document.querySelector('#explore');
    if (!root)
        return;
    const $ = selector => root.querySelector(selector);
    const form = $('#explore-filters');
    const list = $('#explore-list');
    const message = $('#explore-message');
    const detail = $('#explore-detail-content');
    const fields = [
        'search',
        'country',
        'category',
        'max_price',
        'ordering'
    ];
    const defaults = {
        search: '',
        country: '',
        category: '',
        max_price: '',
        ordering: 'title',
        page: 1,
        selected: null
    };
    const state = { ...defaults };
    const money = value => new Intl.NumberFormat('ru-RU').format(value) + ' ₽';
    let listController, detailController, listVersion = 0, detailVersion = 0, delay;
    let currentPages = 1;

    // Только разметка задаётся в JS. Все сведения о турах приходят с сервера.
    function node(tag, className, text) {
        const result = document.createElement(tag);
        if (className)
            result.className = className;
        if (text !== undefined)
            result.textContent = text;
        return result;

    }

    function restoreURL() {
        const params = new URLSearchParams(location.search);
        fields.forEach(key => {
            state[key] = params.get(key) ?? defaults[key];
        });
        state.search = state.search.slice(0, 100);
        if (![
            'title',
            'price',
            '-price',
            'duration',
            '-duration'
        ].includes(state.ordering))
            state.ordering = 'title';
        state.page = Math.max(1, Math.min(1000000, Number.parseInt(params.get('page'), 10) || 1));
        state.selected = /^\d+$/.test(params.get('selected') || '') ? Number(params.get('selected')) : null;
        fields.forEach(key => {
            // Пока справочники ещё не получены, значение остаётся в state.
            form.elements.namedItem(key).value = state[key];

        });

    }

    function saveURL() {
        const params = new URLSearchParams();
        fields.forEach(key => {
            if (state[key] !== defaults[key])
                params.set(key, state[key]);

        });
        if (state.page > 1)
            params.set('page', state.page);
        if (state.selected)
            params.set('selected', state.selected);
        history.replaceState(null, '', location.pathname + (params.size ? '?' + params : '') + location.hash);

    }

    async function getJSON(url, signal) {
        const response = await fetch(url, { signal, credentials: 'same-origin', headers: { Accept: 'application/json' } });
        let data;
        try {
            data = await response.json();

        }
        catch {
            throw new Error('Сервер вернул неожиданный ответ. Попробуйте ещё раз.');

        }
        if (!response.ok)
            throw new Error(data.error || 'Не удалось получить данные с сервера.');
        return data;

    }

    function stopDetail() {
        ++detailVersion;
        detailController?.abort();
        $('#explore-detail').setAttribute('aria-busy', 'false');

    }

    function invalidate() {
        clearTimeout(delay);
        ++listVersion;
        listController?.abort();
        stopDetail();

    }

    function detailPlaceholder(text) {
        detail.replaceChildren(node('p', 'text-secondary mb-0', text));

    }

    function listMessage(text, type = 'normal', retry = false) {
        message.hidden = false;
        message.className = 'card p-4 mb-3' + (type === 'error' ? ' border-danger' : '');
        message.replaceChildren();
        if (type === 'loading')
            message.append(node('span', 'spinner-border text-primary'));
        message.append(node('p', 'mb-0', text));
        if (retry) {
            const button = node('button', 'btn btn-outline-primary', 'Повторить запрос');
            button.type = 'button';
            button.addEventListener('click', loadList);
            message.append(button);

        }

    }

    function showLoading() {
        list.replaceChildren();
        $('#explore-results').setAttribute('aria-busy', 'true');
        $('#explore-pagination').hidden = true;
        $('#explore-status').textContent = 'Загружаем…';
        listMessage('Ищем подходящие путешествия…', 'loading');
        detailPlaceholder('Дождитесь результатов подбора.');

    }

    function options(select, values, firstLabel, valueKey, labelKey, selected) {
        const first = node('option', '', firstLabel);
        first.value = '';
        select.replaceChildren(first);
        values.forEach(value => {
            const option = node('option', '', value[labelKey]);
            option.value = value[valueKey];
            select.append(option);

        });
        if (selected && !values.some(item => item[valueKey] === selected)) {
            const unknown = node('option', '', 'Неизвестное значение');
            unknown.value = selected;
            select.append(unknown);

        }
        select.value = selected;

    }

    function markSelected() {
        list.querySelectorAll('[data-tour-id]').forEach(button => {
            button.setAttribute('aria-pressed', String(Number(button.dataset.tourId) === state.selected));

        });

    }

    function renderList(data) {
        options(form.elements.country, data.filters.countries, 'Все страны', 'slug', 'name', state.country);
        options(form.elements.category, data.filters.categories, 'Любой отдых', 'value', 'label', state.category);
        state.page = data.page;
        currentPages = data.pages;
        list.replaceChildren();
        $('#explore-status').textContent = data.count ? 'Найдено: ' + data.count : 'Нет совпадений';
        message.hidden = data.count > 0;
        if (!data.count) {
            listMessage('Туры не найдены. Измените запрос или сбросьте фильтры.');
            state.selected = null;
            detailPlaceholder('По текущим условиям нет туров. Попробуйте другой поиск.');

        }
        data.results.forEach(tour => {
            const button = node('button', 'explore-tour');
            button.type = 'button';
            button.dataset.tourId = tour.id;
            button.setAttribute('aria-controls', 'explore-detail');
            const image = node('img');
            image.src = tour.image_url;
            image.alt = '';
            const body = node('span', 'explore-tour-body');
            body.append(node('span', 'badge bg-orange-lt', tour.country.name));
            body.append(node('span', 'explore-tour-title', tour.title));
            body.append(node('span', 'explore-tour-meta', tour.category_label + ' · Дней: ' + tour.duration));
            body.append(node('span', 'explore-tour-price', money(tour.price)));
            body.append(node('span', 'explore-tour-meta mt-1', 'Программа и подробности →'));
            button.append(image, body);
            button.addEventListener('click', () => {
                state.selected = tour.id;
                saveURL();
                markSelected();
                loadDetail(tour.id, true);

            });
            list.append(button);

        });
        $('#explore-pagination').hidden = data.pages <= 1;
        $('#explore-prev').disabled = data.page <= 1;
        $('#explore-next').disabled = data.page >= data.pages;
        $('#explore-page-label').textContent = 'Страница ' + data.page + ' из ' + data.pages;
        if (data.results.length) {
            if (!data.results.some(tour => tour.id === state.selected))
                state.selected = data.results[0].id;
            markSelected();
            loadDetail(state.selected);

        }
        saveURL();

    }

    async function loadList() {
        invalidate();
        const version = listVersion;
        const controller = new AbortController();
        listController = controller;
        showLoading();
        saveURL();
        // Таймаут тоже завершает запрос понятной ошибкой, а не вечным спиннером.
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 12000);
        const params = new URLSearchParams();
        fields.forEach(key => {
            if (state[key])
                params.set(key, state[key]);
        });
        params.set('page', state.page);
        try {
            const data = await getJSON(root.dataset.listUrl + '?' + params, controller.signal);
            if (version !== listVersion || controller.signal.aborted)
                return;
            renderList(data);

        } catch (error) {
            if (version !== listVersion || (error.name === 'AbortError' && !timedOut))
                return;
            $('#explore-status').textContent = 'Ошибка загрузки';
            listMessage(timedOut ? 'Сервер долго не отвечает. Повторите запрос.' :
                (error instanceof TypeError ? 'Нет связи с сервером. Проверьте подключение и повторите запрос.' : error.message), 'error', true);
            state.selected = null;
            saveURL();
            detailPlaceholder('Подробности появятся после успешной загрузки списка.');

        } finally {
            clearTimeout(timeout);
            if (version === listVersion)
                $('#explore-results').setAttribute('aria-busy', 'false');

        }

    }

    function renderDetail(tour) {
        const photo = node('img', 'explore-detail-photo');
        photo.src = tour.image_url;
        photo.alt = tour.country.name;
        const tags = node('div', 'text-secondary small', tour.country.name + ' · ' + tour.category_label + ' · Дней: ' + tour.duration);
        detail.replaceChildren(photo, tags, node('h3', 'mt-2 mb-0', tour.title),
            node('div', 'explore-detail-price', money(tour.price)),
            node('div', 'text-secondary small mb-4', 'за одного человека'),
            node('h4', '', 'Программа путешествия'), node('p', '', tour.description),
            node('h4', 'mt-4', 'Включено в стоимость'), node('p', '', tour.included),
            node('h4', 'mt-4', 'О направлении'), node('p', 'text-secondary', tour.country_description));
        const actions = node('div', 'explore-detail-actions');
        const booking = node('a', 'btn btn-primary', 'Оформить заявку');
        booking.href = tour.booking_url + '#booking-form';
        const favorite = node('button', 'btn btn-outline-secondary favorite-btn', tour.favorite ? '♥' : '♡');
        favorite.type = 'button';
        favorite.dataset.favorite = tour.id;
        favorite.setAttribute('aria-label', 'Избранное: ' + tour.title);
        favorite.setAttribute('aria-pressed', String(tour.favorite));
        actions.append(booking, favorite);
        detail.append(actions);

    }

    async function loadDetail(id, scroll = false) {
        stopDetail();
        const version = detailVersion;
        const controller = new AbortController();
        detailController = controller;
        $('#explore-detail').setAttribute('aria-busy', 'true');
        detail.replaceChildren(node('span', 'spinner-border text-primary'), node('p', 'text-center', 'Загружаем программу тура…'));
        if (scroll && matchMedia('(max-width: 767px)').matches)
            $('#explore-detail').scrollIntoView({ behavior: 'auto', block: 'start' });
        let timedOut = false;
        const timeout = setTimeout(() => {
            timedOut = true;
            controller.abort();
        }, 12000);
        try {
            const url = root.dataset.detailUrl.replace('/0/', '/' + id + '/');
            const tour = await getJSON(url, controller.signal);
            if (version !== detailVersion || controller.signal.aborted || state.selected !== id)
                return;
            renderDetail(tour);

        } catch (error) {
            if (version !== detailVersion || (error.name === 'AbortError' && !timedOut))
                return;
            const retry = node('button', 'btn btn-outline-primary', 'Повторить загрузку карточки');
            retry.type = 'button';
            retry.addEventListener('click', () => loadDetail(id));
            detail.replaceChildren(node('p', 'text-danger', timedOut ? 'Сервер долго не отвечает.' :
                (error instanceof TypeError ? 'Не удалось загрузить программу. Проверьте подключение.' : error.message)), retry);

        } finally {
            clearTimeout(timeout);
            if (version === detailVersion)
                $('#explore-detail').setAttribute('aria-busy', 'false');

        }

    }

    function changed(wait = 0) {
        // Отменяем старые ответы сразу при вводе, до debounce нового запроса.
        invalidate();
        fields.forEach(key => {
            state[key] = form.elements.namedItem(key).value;
        });
        state.page = 1;
        state.selected = null;
        saveURL();
        showLoading();
        if (!form.checkValidity()) {
            $('#explore-results').setAttribute('aria-busy', 'false');
            $('#explore-status').textContent = 'Проверьте параметры';
            listMessage('Бюджет должен быть целым числом от 0 до 1 000 000 000 ₽.');
            return;

        }
        delay = setTimeout(loadList, wait);

    }

    form.addEventListener('submit', event => {
        event.preventDefault();
        changed();
    });
    form.addEventListener('input', event => {
        if (event.target.tagName === 'INPUT')
            changed(320);
    });
    form.addEventListener('change', event => {
        if (event.target.tagName === 'SELECT')
            changed();
    });
    form.addEventListener('reset', event => {
        event.preventDefault();
        Object.assign(state, defaults);
        fields.forEach(key => {
            form.elements.namedItem(key).value = defaults[key];
        });
        loadList();

    });
    $('#explore-refresh').addEventListener('click', loadList);
    $('#explore-prev').addEventListener('click', () => {
        if (state.page > 1) {
            --state.page;
            state.selected = null;
            loadList();
        }
    });
    $('#explore-next').addEventListener('click', () => {
        if (state.page < currentPages) {
            ++state.page;
            state.selected = null;
            loadList();
        }
    });
    window.addEventListener('popstate', () => {
        restoreURL();
        loadList();
    });
    restoreURL();
    loadList();
})();
