/**
 * High-level editor interface that communicates with underlying editor (like 
 * TinyMCE, CKEditor, etc.) or browser.
 * Basically, you should call <code>zen_editor.setContext(obj)</code> method to
 * set up undelying editor context before using any other method.
 * 
 * This interface is used by <i>zen_actions.js</i> for performing different 
 * actions like <b>Expand abbreviation</b>  
 * 
 * @example
 * var textarea = document.getElemenetsByTagName('textarea')[0];
 * zen_editor.setContext(textarea);
 * //now you are ready to use editor object
 * zen_editor.getSelectionRange();
 * 
 * @author Sergey Chikuyonok (serge.che@gmail.com)
 * @link http://chikuyonok.ru
 */

var zen_editor = (function(){
	var context = null;
	
	var know_syntaxes = {
		'html': 1,
		'css': 1,
		'xml': 1,
		'xml': 1,
		'haml': 1
	};
	
	/**
	 * Find start and end index of text line for <code>from</code> index
	 * @param {String} text 
	 * @param {Number} from 
	 */
	function findNewlineBounds(text, from) {
		var len = text.length,
			start = 0,
			end = len - 1;
		
		// search left
		for (var i = from - 1; i > 0; i--) {
			var ch = text.charAt(i);
			if (ch == '\n' || ch == '\r') {
				start = i + 1;
				break;
			}
		}
		// search right
		for (var j = from; j < len; j++) {
			var ch = text.charAt(j);
			if (ch == '\n' || ch == '\r') {
				end = j;
				break;
			}
		}
		
		return {start: start, end: end};
	}
	
	var _char_byte_map = null,
		_last_text = null; 
	
	/**
	 * Creates bytes<->character map for UTF8 to deal with Scintilla awkward behavior
	 * @param {String} text Text to create map from. The char map will be valid
	 * for this text only
	 * @return {Object}
	 */
	function createCharByteMap(text) {
		var last_char = 0, 
			last_byte = 0,
			result = {
				bytes: [], // bytes to chars
				chars: []  // chars to bytes
			},
			char_code,
			char_len;
			
		for (var i = 0, il = text.length; i < il; i++) {
			char_code = text.charCodeAt(i);
			if (char_code < 128) {
				char_len = 1;
			} else if (char_code > 127 && char_code < 2048) {
				char_len = 2;
			} else if (char_code > 2047 && char_code < 65536) {
				char_len = 3;
			} else {
				char_len = 4;
			}
			
			result.bytes[last_byte] = last_char;
			result.chars[last_char] = last_byte;
			
			last_char++;
			last_byte += char_len;
		}
		
		result.bytes[last_byte] = last_char;
		result.chars[last_char] = last_byte;
		
		return result;
	}
	
	function updateCharMap() {
		if (_last_text !== context.text) {
			_last_text = context.text;
			_char_byte_map = createCharByteMap(_last_text);
		}
	}
	
	/**
	 * Converts character position into byte position
	 * @param {Number} char_pos
	 */
	function charToBytes(char_pos) {
		if (context.codepage == 65001) {
			updateCharMap();
			return _char_byte_map.chars[char_pos];
		} else {
			_last_text = null;
			return char_pos;
		}
	}
	
	/**
	 * Converts byte position into character position
	 * @param {Number} byte_pos
	 */
	function byteToChars(byte_pos) {
		if (context.codepage == 65001) {
			updateCharMap();
			return _char_byte_map.bytes[byte_pos];
		} else {
			_last_text = null;
			return byte_pos;
		}
	}
	
	/**
	 * Returns whitrespace padding of string
	 * @param {String} str String line
	 * @return {String}
	 */
	function getStringPadding(str) {
		return (str.match(/^(\s+)/) || [''])[0];
	}
	
	return {
		/**
		 * Setup underlying editor context. You should call this method 
		 * <code>before</code> using any Zen Coding action.
		 * @param {Object} context
		 */
		setContext: function(ctx) {
			context = ctx;
		},
		
		/**
		 * Returns character indexes of selected text: object with <code>start</code>
		 * and <code>end</code> properties. If there's no selection, should return 
		 * object with <code>start</code> and <code>end</code> properties referring
		 * to current caret position
		 * @return {Object}
		 * @example
		 * var selection = zen_editor.getSelectionRange();
		 * alert(selection.start + ', ' + selection.end); 
		 */
		getSelectionRange: function() {
			return {
				start: byteToChars(Math.min(context.anchor, context.pos)),
				end: byteToChars(Math.max(context.anchor, context.pos))
			};
		},
		
		/**
		 * Creates selection from <code>start</code> to <code>end</code> character
		 * indexes. If <code>end</code> is ommited, this method should place caret 
		 * and <code>start</code> index
		 * @param {Number} start
		 * @param {Number} [end]
		 * @example
		 * zen_editor.createSelection(10, 40);
		 * 
		 * //move caret to 15th character
		 * zen_editor.createSelection(15);
		 */
		createSelection: function(start, end) {
			context.anchor = charToBytes(start);
			context.pos = charToBytes(end);
		},
		
		/**
		 * Returns current line's start and end indexes as object with <code>start</code>
		 * and <code>end</code> properties
		 * @return {Object}
		 * @example
		 * var range = zen_editor.getCurrentLineRange();
		 * alert(range.start + ', ' + range.end);
		 */
		getCurrentLineRange: function() {
			return findNewlineBounds(this.getContent(), this.getCaretPos());
		},
		
		/**
		 * Returns current caret position
		 * @return {Number|null}
		 */
		getCaretPos: function(){
			return byteToChars(context.pos);
		},
		
		/**
		 * Set new caret position
		 * @param {Number} pos Caret position
		 */
		setCaretPos: function(pos) {
			context.anchor = context.pos = charToBytes(pos);
		},
		
		/**
		 * Returns content of current line
		 * @return {String}
		 */
		getCurrentLine: function() {
			var range = this.getCurrentLineRange();
			return this.getContent().substring(range.start, range.end);
		},
		
		/**
		 * Replace editor's content or it's part (from <code>start</code> to 
		 * <code>end</code> index). If <code>value</code> contains 
		 * <code>caret_placeholder</code>, the editor will put caret into 
		 * this position. If you skip <code>start</code> and <code>end</code>
		 * arguments, the whole target's content will be replaced with 
		 * <code>value</code>. 
		 * 
		 * If you pass <code>start</code> argument only,
		 * the <code>value</code> will be placed at <code>start</code> string 
		 * index of current content. 
		 * 
		 * If you pass <code>start</code> and <code>end</code> arguments,
		 * the corresponding substring of current target's content will be 
		 * replaced with <code>value</code>. 
		 * @param {String} value Content you want to paste
		 * @param {Number} [start] Start index of editor's content
		 * @param {Number} [end] End index of editor's content
		 */
		replaceContent: function(value, start, end) {
			var caret_pos = this.getCaretPos(),
				caret_placeholder = zen_coding.getCaretPlaceholder(),
				has_start = typeof(start) !== 'undefined',
				has_end = typeof(end) !== 'undefined';
				
			// indent new value
			value = zen_coding.padString(value, getStringPadding(this.getCurrentLine()));
			
			// find new caret position
			var new_pos = value.indexOf(caret_placeholder);
			if (new_pos != -1) {
				caret_pos = (start || 0) + new_pos;
				value = value.split(caret_placeholder).join('');
				
				// adjust caret position by line count
//				var lines = zen_coding.splitByLines(value.substring(0, new_pos));
//				caret_pos += lines.length - 1;
			} else {
				caret_pos = value.length + (start || 0);
				
				// adjust caret position by line count
//				var lines = zen_coding.splitByLines(value);
//				caret_pos += lines.length - 1;
			}
			
			if (!has_start && !has_end) {
				start = 0;
				end = content.length;
			} else if (!has_end) {
				end = start;
			}
			
			this.createSelection(start, end);
			context.selection = value;
			this.setCaretPos(caret_pos);
		},
		
		/**
		 * Returns editor's content
		 * @return {String}
		 */
		getContent: function(){
			return context.text || '';
		},
		
		/**
		 * Returns current editor's syntax mode
		 * @return {String}
		 */
		getSyntax: function() {
			var syntax = (Editor.langs[context.lang] || '').toLowerCase(),
				caret_pos = this.getCaretPos();
				
			if (!(syntax in know_syntaxes)) {
				syntax = 'html';
			}
			
			if (syntax == 'html') {
				// get the context tag
				var pair = zen_coding.html_matcher.getTags(this.getContent(), caret_pos);
				if (pair && pair[0] && pair[0].type == 'tag' && pair[0].name.toLowerCase() == 'style') {
					// check that we're actually inside the tag
					if (pair[0].end <= caret_pos && pair[1].start >= caret_pos)
						syntax = 'css';
				}
			}
			
			return syntax;
		},
		
		/**
		 * Returns current output profile name (@see zen_coding#setupProfile)
		 * @return {String}
		 */
		getProfileName: function() {
			return 'xhtml';
		}
	};
})();
