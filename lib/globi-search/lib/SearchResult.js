var inherits = require('util').inherits;
var EventEmitter = require('events').EventEmitter;
var extend = require('extend');
var taxaprisma = require('taxaprisma');

inherits(SearchResult, EventEmitter);

function SearchResult(settings) {
    if (!(this instanceof SearchResult)) { return new SearchResult(settings); }

    this.settings = extend({
        searchContext: { on: function() {} }
    }, settings);

    this.statistics = {
        interactions: [],
        sources: [],
        targets: []
    };

    this.searchContext = this.settings['searchContext'];
    delete this.settings['searchContext'];
    this.init();
}

extend(SearchResult.prototype, {
    init: function() {
        var me = this;
        me.events();

        me.el = createElement('div', false, ['table-wrapper']);
    },

    events: function() {
        var me = this;
        me.on('searchresult:itemclick', me.itemClicked);
        me.searchContext.on('searchfilter:showresults', proxy(me.showList, me));
        me.searchContext.on('searchfilter:showitem', proxy(me.showItem, me));
    },

    appendTo: function(target) {
        var me = this;
        if (typeof target === 'string') target = document.querySelector(target);

        var div = createElement('div', 'result-list');
        div.appendChild(me.el);
        target.appendChild(div);

        me.emit('append', target);
    },


    clear: function() {
        var me = this;
        me.el.innerHTML = '';
    },

    showList: function(data, downloadlinks) {
        var me = this;
        me.clear();
        downloadlinks = downloadlinks || [];
        if (data.length > 0) {
            var itemId, stats = { sources: [], targets: [], linkCount: 0}, row, th, sourceCell, targetCell, linkCell, odd = false;
            var table = createElement('table', 'result-table');
            var tableHead = createElement('thead');
            var tableBody = createElement('tbody');
            var itemIdCache = [];
            data.forEach(function(item) {
                itemId = me.stat(item);
                if (!itemId) return;

                row = createElement('tr', itemId, ['result-item', (odd ? 'odd' : 'even')]);
                row.addEventListener('click', function() { me.emit('searchresult:itemclick', item); });
                row.innerHTML = [
                    '<td class="source-cell" ' + getStyleAttribute(item['source'].path) + '>', item['source'].name, '</td>',
                    '<td class="link-cell">', item['link'].name, '</td>',
                    '<td class="target-cell" ' + getStyleAttribute(item['target'].path) + '">', item['target'].name, '</td>'
                ].join('');

                tableBody.appendChild(row);
                odd = !odd;
            });

            var linkRefs = downloadlinks.map(function(link) {
                var downloadText = 'download csv data sample';
                return '<a href="' + link.url + '" class="link" title="download up to 4096 related interaction records">' + downloadText + '</a>';
            }).join(' ');
            tableHead.innerHTML = [
                '<tr><th class="source-cell">' + linkRefs + '</th>',
                ('<th></th>'),
                '<th class="target-cell"><a href="/data#interaction-data-indexes">access full dataset</a></th></tr>',
                '<tr>',
                    '<th class="source-cell">taxon</th>',
                    '<th class="download">',
                        camelCaseToRealWords(me.searchContext.getParameter('interactionType')),
                    '</th>',
                    '<th class="target-cell">taxon</th>',
                '</tr>',
                '<tr>',
                    '<th>(', me.statistics['sources'].length, ' distinct)</th>',
                    '<th>','(', me.statistics['interactions'].length, ' distinct interactions)</th>',
                    '<th>(', me.statistics['targets'].length, ' distinct)</th></tr>'
            ].join('');

            table.appendChild(tableHead);
            table.appendChild(tableBody);

            me.el.appendChild(table);
        } else {
            me.el.innerHTML = '<p>No interaction data was found with your criteria. Bummer!</p>' +
                '<br/><p>Suggest to make your search more general (e.g. Aves eats Insecta), increase your search area or <a href="https://github.com/globalbioticinteractions/globalbioticinteractions/wiki/How-to-Contribute-Data-to-Global-Biotic-Interactions%3F">contribute more data</a>.</p>' +
                '<br/><p>Please <a href="https://github.com/globalbioticinteractions/globalbioticinteractions.github.io/issues/new">open an issue</a> if you have suggestions or questions.</p>';
        }
        me.searchContext.unlockFetching('SearchResult::showList');
    },

    showItem: function(item) {
        var me = this, itemId, infoBox, activeRow;

        activeRow = document.getElementsByClassName('active-row');
        if (activeRow.length > 0) {
            activeRow[0].classList.remove('active-row');
        }

        itemId = [item['source'].id, item['link'].id, item['target'].id].join('---');

        infoBox = document.getElementById('info-box');
        if (infoBox) {
            infoBox.parentNode.removeChild(infoBox);
        }

        infoBox = createElement('tr', 'info-box', ['result-row']);
        infoBox.innerHTML = [
            '<td class="result-source">',
                '<div class="source-label">' + item['source'].label + '</div>',
                item['source'].data,
            '</td>',
            '<td class="result-link"><div class="link-label">' + item['link'].label + '</div><div class="link-data">' + item['link'].data + '</div></td>',
            '<td class="result-target">',
                '<div class="target-label">' + item['target'].label + '</div>',
                item['target'].data,
            '</td>',
        ].join('');

        activeRow = document.getElementById(itemId);
        activeRow.parentNode.insertBefore(infoBox, activeRow);
        activeRow.classList.add('active-row');

        me.searchContext.unlockFetching('SearchResult::showItem');
    },

    itemClicked: function(data) {
        var me = this;
        me.searchContext.emit('searchresult:itemselected', data);
    },

    stat: function(item) {
        var s = this.statistics;
        var interactionId = [
            item['source'].id,
            item['link'].id,
            item['target'].id
        ].join('---');

        if (s.interactions.indexOf(interactionId) !== -1) {
            return false;
        }
        s.interactions.push(interactionId);

        if (s.sources.indexOf(item['source'].id) === -1) {
            s.sources.push(item['source'].id);
        }
        if (s.targets.indexOf(item['target'].id) === -1) {
            s.targets.push(item['target'].id);
        }
        return interactionId;
    }
});

function proxy(fn, context) {
    return function() {
        return fn.apply(context, arguments);
    };
}

/**
 * @param elementName
 * @param id
 * @param classes
 * @returns {Element}
 */
function createElement(elementName, id, classes) {
    elementName = elementName || 'div';
    id = id || false;
    classes = classes || [];

    var div = document.createElement(elementName);
    if (id) div.id = id;
    if (classes.length > 0 ) div.className = classes.join(' ');
    return div;
}

function camelCaseToRealWords(str) {
    str = str.replace(/([A-Z])/g, function($1){return " "+$1.toLowerCase();});
    var strParts = str.split(' '), lastPart = strParts[strParts.length - 1];
    if (['of', 'by'].indexOf(lastPart) >= 0) {
        strParts.unshift('is');
    }
    return strParts.join(' ');
}

function getStyleAttribute(path) {
    return 'style="color: ' + taxaprisma.colorFor(path) + ';"'
}

module.exports = SearchResult;
