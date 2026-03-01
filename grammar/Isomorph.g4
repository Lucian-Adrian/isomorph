// ============================================================
// Isomorph DSL — ANTLR4 Grammar Reference
// ============================================================
// This grammar file serves as a formal, machine-readable spec
// of the Isomorph language. It mirrors the hand-written parser
// in src/parser/parser.ts and the BNF rules in the Week 5
// grammar report.
//
// File extension for Isomorph source files: .isx
//
// To generate a parser from this grammar:
//   npx antlr4ts Isomorph.g4 -visitor -o src/generated
//
// ── Static Semantic Rules (enforced by src/semantics/analyzer.ts) ──
//   SS-1:  Unique entity names within diagram scope
//   SS-2:  Unique member names within each entity
//   SS-3:  Referential integrity — relation endpoints must exist
//   SS-4:  Enum must declare at least one value
//   SS-5:  Interface fields cannot have default values
//   SS-6:  No circular direct inheritance chains
//   SS-7:  Style target must reference a declared entity
//   SS-8:  Enum value uniqueness within each enum
//   SS-9:  Diagram kind compatibility (entity ↔ diagram)
//   SS-10: Layout annotation must reference a declared entity
//   SS-11: Abstract entity cannot also be marked final
//   SS-12: Method parameter names must be unique per method
//   SS-13: Extends target must reference a declared entity
//   SS-14: Implements target must reference a declared entity
// ============================================================

grammar Isomorph;

// ─── Parser Rules ────────────────────────────────────────────

program
    : importDecl* diagramDecl+ EOF
    ;

importDecl
    : KW_IMPORT STRING SEMI?
    ;

diagramDecl
    : KW_DIAGRAM IDENT COLON diagramKind LBRACE diagramBody RBRACE
    ;

diagramKind
    : KW_CLASS
    | KW_USECASE
    | KW_SEQUENCE
    | KW_COMPONENT
    | KW_FLOW
    | KW_DEPLOYMENT
    ;

diagramBody
    : bodyItem*
    ;

bodyItem
    : packageDecl
    | entityDecl
    | relationDecl
    | noteDecl
    | styleDecl
    | layoutAnnotation
    ;

// ─── Package ─────────────────────────────────────────────────

packageDecl
    : KW_PACKAGE IDENT LBRACE diagramBody RBRACE
    ;

// ─── Entity ──────────────────────────────────────────────────

entityDecl
    : modifierList entityKind IDENT stereotypeOpt inheritanceOpt entityBodyOpt
    ;

modifierList
    : ( KW_ABSTRACT | KW_STATIC | KW_FINAL )*
    ;

entityKind
    : KW_CLASS
    | KW_INTERFACE
    | KW_ENUM
    | KW_ACTOR
    | KW_USECASE
    | KW_COMPONENT
    | KW_NODE
    ;

stereotypeOpt
    // NOTE: '>>' is deliberately NOT lexed as a STEREO_CLOSE token by the
    // hand-written lexer.  Using a dedicated STEREO_CLOSE token would cause
    // a maximal-munch ambiguity with nested generics such as Map<K,List<V>>,
    // where the closing '>>' must be two separate GT tokens.  The parser
    // therefore consumes two consecutive GT tokens for the stereotype close.
    : STEREO_OPEN IDENT GT GT
    |
    ;

inheritanceOpt
    : KW_EXTENDS identList implementsOpt
    | KW_IMPLEMENTS identList
    |
    ;

implementsOpt
    : KW_IMPLEMENTS identList
    |
    ;

identList
    : IDENT ( COMMA IDENT )*
    ;

entityBodyOpt
    : LBRACE memberList RBRACE
    |
    ;

memberList
    : member*
    ;

member
    : fieldDecl
    | methodDecl
    | enumValueDecl
    | SEMI
    ;

// ─── Members ─────────────────────────────────────────────────

fieldDecl
    : visibilityOpt memberModifierList IDENT COLON typeExpr defaultOpt SEMI?
    ;

methodDecl
    : visibilityOpt memberModifierList IDENT LPAREN paramListOpt RPAREN COLON typeExpr SEMI?
    ;

enumValueDecl
    : IDENT SEMI?
    ;

visibilityOpt
    : PLUS
    | MINUS
    | HASH
    | TILDE
    |
    ;

memberModifierList
    : ( KW_ABSTRACT | KW_STATIC | KW_FINAL )*
    ;

defaultOpt
    : EQ literal
    |
    ;

paramListOpt
    : paramList
    |
    ;

paramList
    : param ( COMMA param )*
    ;

param
    : IDENT COLON typeExpr
    ;

// ─── Types ───────────────────────────────────────────────────

typeExpr
    : typeName ( LT typeArgList GT )?
    | typeExpr QUESTION         // nullable
    ;

typeName
    : IDENT
    | KW_INT | KW_FLOAT | KW_BOOL | KW_STRING | KW_VOID
    | KW_LIST | KW_MAP | KW_SET | KW_OPTIONAL
    ;

typeArgList
    : typeExpr ( COMMA typeExpr )*
    ;

// ─── Relations ───────────────────────────────────────────────

relationDecl
    : IDENT relOp IDENT relationAttrs?
    ;

relOp
    : REL_ASSOC
    | REL_ASSOC_DIR
    | REL_INHERIT
    | REL_REALIZE
    | REL_AGGR
    | REL_COMPOSE
    | REL_RESTR
    | REL_DEPEND
    | REL_INHERIT_R
    | REL_REALIZE_R
    | REL_DEPEND_R
    | REL_AGGR_R
    | REL_COMPOSE_R
    ;

relationAttrs
    : LBRACKET attrList RBRACKET
    ;

attrList
    : attr ( COMMA attr )*
    ;

attr
    : IDENT EQ STRING
    ;

// ─── Notes, Style, Layout ────────────────────────────────────

noteDecl
    : KW_NOTE STRING ( KW_ON IDENT )?
    ;

styleDecl
    : KW_STYLE IDENT LBRACE styleAttr* RBRACE
    ;

styleAttr
    : IDENT EQ ( STRING | COLOR ) SEMI?
    ;

layoutAnnotation
    : AT IDENT KW_AT LPAREN NUMBER COMMA NUMBER RPAREN
    ;

// ─── Literals ────────────────────────────────────────────────

literal
    : STRING
    | NUMBER
    | KW_TRUE
    | KW_FALSE
    ;

// ─── Lexer Rules ─────────────────────────────────────────────

// Keywords
KW_DIAGRAM    : 'diagram' ;
KW_CLASS      : 'class' ;
KW_INTERFACE  : 'interface' ;
KW_ENUM       : 'enum' ;
KW_ABSTRACT   : 'abstract' ;
KW_PACKAGE    : 'package' ;
KW_IMPORT     : 'import' ;
KW_NOTE       : 'note' ;
KW_STYLE      : 'style' ;
KW_ON         : 'on' ;
KW_EXTENDS    : 'extends' ;
KW_IMPLEMENTS : 'implements' ;
KW_AT         : 'at' ;
KW_STATIC     : 'static' ;
KW_FINAL      : 'final' ;
KW_VOID       : 'void' ;
KW_FOR        : 'for' ;
KW_ACTOR      : 'actor' ;
KW_USECASE    : 'usecase' ;
KW_COMPONENT  : 'component' ;
KW_NODE       : 'node' ;
KW_SEQUENCE   : 'sequence' ;
KW_FLOW       : 'flow' ;
KW_DEPLOYMENT : 'deployment' ;
KW_LIST       : 'list' ;
KW_MAP        : 'map' ;
KW_SET        : 'set' ;
KW_OPTIONAL   : 'optional' ;
KW_INT        : 'int' ;
KW_FLOAT      : 'float' ;
KW_BOOL       : 'bool' ;
KW_STRING     : 'string' ;
KW_TRUE       : 'true' ;
KW_FALSE      : 'false' ;

// Relation operators (order matters — longest match first in ANTLR4)
REL_INHERIT   : '--|>' ;
REL_REALIZE   : '..|>' ;
REL_INHERIT_R : '<|--' ;
REL_REALIZE_R : '<|..' ;
REL_DEPEND_R  : '<..' ;
REL_AGGR_R    : 'o--' ;
REL_COMPOSE_R : '*--' ;
REL_ASSOC_DIR : '-->' ;
REL_DEPEND    : '..>' ;
REL_AGGR      : '--o' ;
REL_COMPOSE   : '--*' ;
REL_RESTR     : '--x' ;
REL_ASSOC     : '--' ;

// Stereotype open delimiter ('>>' seen in source is consumed as GT GT — see stereotypeOpt)
STEREO_OPEN   : '<<' ;
// NOTE: STEREO_CLOSE ('>>') is intentionally absent from the lexer rules.
//       Two consecutive GT tokens are used instead to avoid maximal-munch
//       ambiguity with closing nested generic type arguments.

// Literals
STRING  : '"' ( ~["\\\r\n] | '\\' . )* '"' ;
NUMBER  : '-'? [0-9]+ ( '.' [0-9]+ )? ;
COLOR   : '#' [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F]
               [0-9a-fA-F] [0-9a-fA-F] [0-9a-fA-F] ;
IDENT   : [a-zA-Z_] [a-zA-Z0-9_]* ;

// Punctuation
LBRACE   : '{' ;
RBRACE   : '}' ;
LPAREN   : '(' ;
RPAREN   : ')' ;
LT       : '<' ;
GT       : '>' ;
LBRACKET : '[' ;
RBRACKET : ']' ;
COMMA    : ',' ;
COLON    : ':' ;
SEMI     : ';' ;
DOT      : '.' ;
AT       : '@' ;
EQ       : '=' ;
PIPE     : '|' ;
PLUS     : '+' ;
MINUS    : '-' ;
HASH     : '#' ;
TILDE    : '~' ;
QUESTION : '?' ;
DOTDOT   : '..' ;

// Whitespace and comments (skip)
WS           : [ \t\r\n]+    -> skip ;
LINE_COMMENT : '//' ~[\r\n]* -> skip ;
BLOCK_COMMENT: '/*' .*? '*/' -> skip ;
