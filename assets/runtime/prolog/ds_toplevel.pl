% DesktopSim: Hilfsprädikate für das Prolog-Toplevel im Browser (SWI-Prolog/WebAssembly).
% ds_query/3 liefert pro Lösung den Text der Variablenbelegung wie im SWI-Toplevel und ob
% keine weiteren Lösungen möglich sind (Det = true).

:- set_prolog_flag(verbose_load, silent).

ds_consult(File) :-
    catch(consult(user:File), E, (print_message(error, E), fail)).

ds_query(QueryString, Out, Det) :-
    catch(term_string(Goal, QueryString, [variable_names(Names), module(user)]), E,
          (ds_report(E), Out = "$error", Det = true)),
    (   nonvar(Out)
    ->  true
    ;   catch(( call_cleanup(user:Goal, Done = true),
                ds_bindings(Names, Out0),
                (   Done == true -> Det = true ; Det = false ),
                Out = Out0
              ),
              E2,
              ( ds_report(E2), Out = "$error", Det = true ))
    ).

ds_report(error(Formal, context(_, Msg))) :- !,
    print_message(error, error(Formal, context(_, Msg))).
ds_report(error(Formal, _)) :- !,
    print_message(error, error(Formal, _)).
ds_report(E) :-
    print_message(error, E).

ds_bindings(Names, Text) :-
    include(ds_visible, Names, Visible),
    (   Visible == []
    ->  Text = "true"
    ;   maplist(ds_binding, Visible, Parts),
        atomic_list_concat(Parts, ',\n', Atom),
        atom_string(Atom, Text)
    ).

ds_visible(Name = Value) :-
    \+ sub_atom(Name, 0, 1, _, '_'),
    \+ ( var(Value), ds_fresh(Value) ).

ds_fresh(_).

ds_binding(Name = Value, Text) :-
    format(string(Text), "~w = ~W",
           [Name, Value, [quoted(true), portray(true), max_depth(20), spacing(next_argument)]]).

% Für die Datenbank-Ansicht: alle Lösungen als Tabelle (Spaltennamen, Zeilen als Text).
ds_table(QueryString, Names, Rows) :-
    term_string(Goal, QueryString, [variable_names(Bindings), module(user)]),
    include(ds_named, Bindings, Visible),
    findall(N, member(N = _, Visible), Names),
    findall(Vs, ( limit(1000, user:Goal),
                  findall(S, ( member(_ = V, Visible), ds_cell(V, S) ), Vs) ),
            Rows).

ds_named(Name = _) :- \+ sub_atom(Name, 0, 1, _, '_').

ds_cell(V, S) :- var(V), !, S = "_".
ds_cell(V, S) :- string(V), !, S = V.
ds_cell(V, S) :- format(string(S), "~W", [V, [quoted(false), portray(true), max_depth(20)]]).

% Prädikate der Wissensbasis (für die Seitenleiste der Datenbank-Ansicht).
ds_predicates(List) :-
    findall(Name/Arity-Count,
            ( current_predicate(user:Name/Arity),
              functor(H, Name, Arity),
              \+ predicate_property(user:H, imported_from(_)),
              \+ sub_atom(Name, 0, 3, _, ds_),
              \+ predicate_property(user:H, multifile),
              (   predicate_property(user:H, file(F)),
                  ( sub_atom(F, 0, _, _, '/tmp/ds_') ; sub_atom(F, 0, _, _, '/home/student/work') )
              ;   predicate_property(user:H, dynamic), \+ predicate_property(user:H, file(_))
              ),
              predicate_property(user:H, number_of_clauses(Count))
            ), List0),
    sort(List0, List).
