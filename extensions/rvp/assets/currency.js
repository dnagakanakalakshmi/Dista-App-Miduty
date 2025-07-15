
window.CurrencyUtils = {
    formatMoneyCurrency(cents, format) {

        if (typeof cents === 'string') cents = cents.replace('.', '');
        let value = '';
        const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
        const formatString = format || window.money_format || "${{amount}}";
        
        const match = formatString.match(placeholderRegex);
        if (!match) {
            // fallback to a default format if no placeholder is found
            return (parseFloat(cents) / 100).toFixed(2);
        }
        
        function defaultOption(opt, def) {
        return (typeof opt === 'undefined' ? def : opt);
        }

        function formatWithDelimiters(number, precision, thousands, decimal) {
        precision = defaultOption(precision, 2);
        thousands = defaultOption(thousands, ',');
        decimal = defaultOption(decimal, '.');

        if (isNaN(number) || number == null) return 0;

        number = (number / 100.0).toFixed(precision);
        const parts = number.split('.');
        const dollars = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, `$1${thousands}`);
        const cents = parts[1] ? (decimal + parts[1]) : '';

        return dollars + cents;
        }

        switch(match[1]) {
        case 'amount':
            value = formatWithDelimiters(cents, 2);
            break;
        case 'amount_no_decimals':
            value = formatWithDelimiters(cents, 0);
            break;
        case 'amount_with_comma_separator':
            value = formatWithDelimiters(cents, 2, '.', ',');
            break;
        case 'amount_no_decimals_with_comma_separator':
            value = formatWithDelimiters(cents, 0, '.', ',');
            break;
        }

        return formatString.replace(placeholderRegex, value);
    },
};