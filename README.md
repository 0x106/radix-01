* goal is not just for the model to output questions (a form) but to add widgets that will persist over the length of the conversation (or longer)
* state is persistent, and global


I have this existing application that I would like to adjust. Instead of the model generating widgets on a per message basis, I would like the model 
to be able to "edit a global widgets object". This is because I'd like the widgets to (potentially) live for the full lifecycle of the conversation 
(and later potentially even longer), rather than being tied to an individual message. I was imagining that we could use (in the simple case) const 
[widgets, updateWidgets] = useState<Widgets[]>([]). When the user sends a message it sends the full stringified state of the widgets to the model 
(as per the current implementation) and then we could have a slightly adjusted schema where the model outputs something like 
[{action: 'ADD', widget: ...}, {action: 'DELETE', widget: {id: ...., ....}}] etc. The actions would probably be ADD, DELETE, UPDATE? And then if a 
widget that has already been created isn't referenced then we just leave its state as it currently is.
